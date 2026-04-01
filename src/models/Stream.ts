import { defineEntity, p } from "@mikro-orm/core";
import Match from "./Match.js";
import Channel from "./Channel.js";

const StreamSchema = defineEntity({
	name: 'Stream',
	properties: {
		id: p.integer().unsigned().autoincrement().primary(),
		twitchId: p.string().length(50).index().unique(),
		title: p.string().length(255),
		startedAt: p.datetime(),
		endedAt: p.datetime().nullable(),
		channel: () => p.manyToOne(Channel),
		matches: () => p.oneToMany(Match).mappedBy('stream'),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date())
	}
})

class Stream extends StreamSchema.class {}
StreamSchema.setClass(Stream)

export default Stream;
