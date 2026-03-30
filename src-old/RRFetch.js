import got from 'got';

class RRFetch {
	apiKey;
	userId;
	userTag;

	lastMatch = null;
	thisStream = 0;

	constructor(apiKey, user) {
		this.apiKey = apiKey;
		this.userId = user.split('#')[0];
		this.userTag = user.split('#')[1];
	}

	async getChange() {
		const match = await this.getLastMatchStatus();

		if(this.lastMatch != match.matchId) {
			this.lastMatch = match.matchId;

			this.thisStream += match.change;

			return {
				...match, thisStream: this.thisStream
			}
		}

		return null;
	}

	async getLastMatchStatus() {
		const data = await got.get(`https://api.henrikdev.xyz/valorant/v1/mmr-history/eu/${this.userId}/${this.userTag}`,
			{
				headers: {
					Authorization: this.apiKey
				}
			}).json();

		const lastMatch = data.data[0];

		if(!lastMatch) {
			return null
		}

		return {
			matchId: lastMatch.match_id,
			rank: lastMatch.currenttierpatched,
			ranking: lastMatch.ranking_in_tier,
			change: lastMatch.mmr_change_to_last_game
		}
	}
}

export default RRFetch;