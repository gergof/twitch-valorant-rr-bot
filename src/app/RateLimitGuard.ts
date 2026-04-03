import Channel from '../models/Channel.js';

class RateLimitGuard {
	private channelTimestamps = new Map<number, number>();

	constructor(private readonly cooldownMs: number) {}

	public isAllowed(channel: Channel): boolean {
		const now = Date.now();
		const lastSentAt = this.channelTimestamps.get(channel.id);

		if (lastSentAt !== undefined && now - lastSentAt < this.cooldownMs) {
			return false;
		}

		this.channelTimestamps.set(channel.id, now);

		return true;
	}
}

export default RateLimitGuard;
