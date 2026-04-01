import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler';

import logger from '../logger.js';
import Channel from '../models/Channel.js';
import Match from '../models/Match.js';
import Stream from '../models/Stream.js';

import App from './App.js';

class TaskRunner {
	private app: App;

	private scheduler = new ToadScheduler();
	private pendingTasks = new Map<string, NodeJS.Timeout>();

	constructor(app: App) {
		this.app = app;
	}

	public stopTasks(): void {
		this.scheduler.stop();
		logger.info('Stopped all RR update tasks');
	}

	private getRRUpdateTaskKey(channel: Channel): string {
		return `rr-update-${channel.id}`;
	}

	public stopRRUpdateTask(channel: Channel): void {
		const key = this.getRRUpdateTaskKey(channel);

		if (this.pendingTasks.has(key)) {
			clearTimeout(this.pendingTasks.get(key));
			this.pendingTasks.delete(key);
		}

		this.scheduler.removeById(key);
		logger.info('Stopped RR update task', {
			channelId: channel.id,
			twitchId: channel.twitchId
		});
	}

	public startRRUpdateTask(channel: Channel, stream: Stream): void {
		this.stopRRUpdateTask(channel);

		const key = this.getRRUpdateTaskKey(channel);
		const initialDelayMs = Math.floor(Math.random() * 60_000);

		logger.info('Scheduling RR update task', {
			channelId: channel.id,
			twitchId: channel.twitchId,
			streamId: stream.id,
			streamTwitchId: stream.twitchId,
			initialDelayMs
		});

		this.pendingTasks.set(
			key,
			setTimeout(() => {
				this.pendingTasks.delete(key);
				logger.info('Starting RR update interval job', {
					channelId: channel.id,
					twitchId: channel.twitchId,
					streamId: stream.id
				});
				this.scheduler.addSimpleIntervalJob(
					new SimpleIntervalJob(
						{ seconds: 60, runImmediately: true },
						new AsyncTask(
							`${key}-task`,
							async () => {
								const em = this.app.orm.em.fork();

								if (!channel.valorantAccount) {
									return;
								}

								let lastMatch;
								try {
									lastMatch =
										await this.app.rrFetcher.getLastMatchStatus(
											channel.valorantAccount
										);
								} catch (error) {
									if (
										error instanceof Error &&
										error.message === 'Invalid user'
									) {
										await this.app.deactivateChannel(
											channel.id
										);
										return;
									}

									throw error;
								}

								if (!lastMatch) {
									return;
								}

								const lastMatchInDb = await em.findOne(
									Match,
									{
										channel: channel
									},
									{
										last: 1
									}
								);

								if (
									lastMatchInDb?.matchId != lastMatch.matchId
								) {
									// store new match
									const match = em.create(Match, {
										matchId: lastMatch.matchId,
										rank: lastMatch.rank,
										rr: lastMatch.rr,
										rrChange: lastMatch.rrChange,
										map: lastMatch.map,
										stream: stream,
										channel: channel
									});
									await em.flush();
									logger.info(
										'Stored new match from RR poll',
										{
											channelId: channel.id,
											streamId: stream.id,
											matchId: match.matchId
										}
									);

									await this.app.sendRRChangeMessage(
										channel,
										stream,
										match
									);
								}
							},
							error => {
								logger.error('RR update task failed', {
									channelId: channel.id,
									twitchId: channel.twitchId,
									error:
										error instanceof Error
											? error.message
											: String(error)
								});
							}
						),
						{
							id: key,
							preventOverrun: true
						}
					)
				);
			}, initialDelayMs)
		);
	}
}

export default TaskRunner;
