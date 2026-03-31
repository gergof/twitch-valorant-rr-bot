import { defineEntity, p } from "@mikro-orm/core";
import Match from "./Match.js";
import Credential from './Credential.js';
import Stream from "./Stream.js";

const ChannelSchema = defineEntity({
	name: 'Channel',
	properties: {
		id: p.integer().unsigned().autoincrement().primary(),
		twitchId: p.string().length(50).index().unique(),
		name: p.string().length(150),
		email: p.string().length(150),
		active: p.boolean().default(true),
		valorantAccount: p.string().length(150).nullable().default(null),
		credential: () => p.oneToOne(Credential).nullable(),
		streams: () => p.oneToMany(Stream).mappedBy('channel'),
		matches: () => p.oneToMany(Match).mappedBy('channel'),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date())
	}
})

class Channel extends ChannelSchema.class {}
ChannelSchema.setClass(Channel)

export default Channel;
