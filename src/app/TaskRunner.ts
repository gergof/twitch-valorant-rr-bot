import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import App from "./App.js";
import Channel from "../models/Channel.js";
import Stream from "../models/Stream.js";
import pLimit from "p-limit";
import Match from "../models/Match.js";

class TaskRunner {
	private app: App

	private scheduler = new ToadScheduler()
	private pendingTasks = new Map<string, NodeJS.Timeout>()

	constructor(app: App) {
		this.app = app;
	}

	public async initializeTasks(): Promise<void> {
		await this.initializeRRUpdateTasks();
		this.initializeStreamWrapUpTask();
	}

	public stopTasks(): void {
		this.scheduler.stop();
	}

	private getRRUpdateTaskKey(channel: Channel): string {
		return `rr-update-${channel.id}`
	}

	public stopRRUpdateTask(channel: Channel): void {
		const key = this.getRRUpdateTaskKey(channel);

		if(this.pendingTasks.has(key)){
			clearTimeout(this.pendingTasks.get(key));
			this.pendingTasks.delete(key);
		}

		this.scheduler.removeById(key)
	}

	public startRRUpdateTask(channel: Channel, stream: Stream): void {
		this.stopRRUpdateTask(channel);

		const key = this.getRRUpdateTaskKey(channel);

		this.pendingTasks.set(key, setTimeout(() => {
			this.scheduler.addSimpleIntervalJob(
				new SimpleIntervalJob(
				{seconds: 60, runImmediately: true},
				new AsyncTask(`${key}-task`, async () => {
					const em = this.app.orm.em.fork();

					if(!channel.valorantAccount) {
						return;
					}

					const lastMatch = await this.app.rrFetcher.getLastMatchStatus(channel.valorantAccount);

					if(!lastMatch) {
						return;
					}

					const lastMatchInDb = await em.findOne(Match, {
						channel: channel
					}, {
						last: 1
					})

					if(lastMatchInDb?.matchId != lastMatch.matchId) {
						// store new match
						const match = em.create(Match, {
							matchId: lastMatch.matchId,
							rank: lastMatch.rank,
							rr: lastMatch.rr,
							rrChange: lastMatch.rrChange,
							map: lastMatch.map,
							stream: stream,
							channel: channel
						})
						await em.flush()

						await this.app.sendRRChangeMessage(channel, stream, match)
					}
				}),
				{
					id: key,
					preventOverrun: true
				}
				)
			)
		}, Math.floor(Math.random() * 60_000)))
	}

	public async restartRRUpdateTaskIfEligible(channel: Channel): Promise<void> {
		const em = this.app.orm.em.fork();

		this.stopRRUpdateTask(channel)

		if(!channel.active || channel.valorantAccount == null) {
			return;
		}

		const liveStream = await em.findOne(Stream, {
			endedAt: null
		}, {
			last: 1
		})

		if(liveStream) {
			this.startRRUpdateTask(channel, liveStream)
		}
	}

	private async initializeRRUpdateTasks(): Promise<void> {
		const em = this.app.orm.em.fork();

		const liveStreams = await em.find(Stream, {
			endedAt: null,
			channel: {
				active: true,
				valorantAccount: {
					$ne: null
				}
			}
		}, {
			populate: ['channel']
		})

		liveStreams.forEach(stream => {
			this.startRRUpdateTask(stream.channel, stream)
		})
	}

	private initializeStreamWrapUpTask(): void {
		this.scheduler.addSimpleIntervalJob(
			new SimpleIntervalJob(
				{hours: 6, runImmediately: true},
				new AsyncTask('stream-wrap-up-task', async () => {
					const em = this.app.orm.em.fork();

					const liveChannels = await em.find(Channel, {
						streams: {
							endedAt: null
						}
					})

					const limit = pLimit(10);
					await Promise.all(liveChannels.map(channel => limit(async () => {
						const channelStream = await this.app.twitchApi.streams.getStreamByUserId(channel.twitchId)

						if(!channelStream) {
							// mark all streams as ended
							await em.nativeUpdate(Stream, {
								channel: channel,
								endedAt: null
							}, {
								endedAt: new Date()
							})
						} else {
							// mark all streams except current as ended
							await em.nativeUpdate(Stream, {
								channel: channel,
								endedAt: null,
								twitchId: {
									$ne: channelStream.id
								}
							}, {
								endedAt: new Date()
							})
						}

						await em.flush()
					})))
				})
			)
		)
	}
}

export default TaskRunner;