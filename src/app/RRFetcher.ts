import got from "got";
import Config from "../Config.js";
import { LastMatchStatus } from "../types.js";
import { VALORANT_API_BASE } from "../constants.js";

class RRFetcher {
	private config: Config;

	constructor(config: Config){
		this.config = config;
	}

	async getLastMatchStatus(valorantAccount: string): Promise<LastMatchStatus | null> {
		const username = valorantAccount.split('#')[0]?.trim();
		const tag = valorantAccount.split('#')[1]?.trim();

		if(!username || !tag) {
			throw new Error('Invalid user')
		}

		try {
			const resp = await got.get<{data: {match_id: string, currenttierpatched: string, ranking_in_tier: number, mmr_change_to_last_game: number, map: {name: string}}[]}>(`${VALORANT_API_BASE}/${encodeURIComponent(username)}/${encodeURIComponent(tag)}`, {
				headers: {
					Authorization: this.config.getValorantApiKey()
				},
				throwHttpErrors: false
			})

			if(resp.statusCode == 404) {
				throw new Error('Invalid user')
			}

			if(resp.statusCode != 200) {
				return null;
			}

			if(resp.body.data.length == 0) {
				return null;
			}

			return {
				matchId: resp.body.data[0].match_id,
				rank: resp.body.data[0].currenttierpatched,
				rr: resp.body.data[0].ranking_in_tier,
				rrChange: resp.body.data[0].mmr_change_to_last_game,
				map: resp.body.data[0].map.name
			}
		} catch (error) {
			if (error instanceof Error && error.message === 'Invalid user') {
				throw error;
			}

			return null;
		}
	}
}

export default RRFetcher
