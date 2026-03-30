import got from 'got';
import dotenv from 'dotenv';
import env from 'env-var';

import TwitchAuth from './TwitchAuth.js'
import RRFetch from './RRFetch.js';
import OauthCb from './OauthCb.js';

const main = () => {
	dotenv.config();

	const valorantApiKey = env.get('VALORANT_API_KEY').required().asString()
	const twitchClientId = env.get('TWITCH_CLIENT_ID').required().asString()
	const twitchClientSecret = env.get('TWITCH_CLIENT_SECRET').required().asString()

	const valorantUser = env.get('VALORANT_USER').required().asString()
	const twitchChannel = env.get('TWITCH_CHANNEL').required().asString()

	const auth = new TwitchAuth(twitchClientId, twitchClientSecret)
	const oauthCb = new OauthCb(auth)
	const rrStat = new RRFetch(valorantApiKey, valorantUser);

	oauthCb.startServer()
	console.log('Open:', auth.getAuthorizationUrl());

	setInterval(async () => {
		if(!auth.isConfigured()) {
			return;
		}

		const rr = await rrStat.getChange()

		if(rr) {
			console.log('Updating RR:', rr)
			const userRes = await got.get('https://api.twitch.tv/helix/users', {
				headers: await auth.getHeaders(),
				searchParams: {
					login: twitchChannel
				}
			}).json();

			const result = await got.post('https://api.twitch.tv/helix/chat/messages', {
				headers: await auth.getHeaders(),
				json: {
					broadcaster_id: userRes.data[0].id,
					sender_id: auth.user,
					message: `Utolsó kör: ${rr.change}. Jelenleg: ${rr.rank} (${rr.ranking}RR). Ebben a streamben eddig: ${rr.thisStream}RR`
				}
			}).json();

			console.log('res:', result)
		}
	}, 15_000)
}

main();