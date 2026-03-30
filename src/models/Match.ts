import { defineEntity, p } from "@mikro-orm/core";
import Stream from "./Stream.js";
import Channel from "./Channel.js";

const MatchSchema = defineEntity({
	name: 'Match',
	properties: {
		id: p.bigint().unsigned().autoincrement().primary(),
		matchId: p.string().length(50),
		rank: p.string().length(30),
		rr: p.smallint(),
		rrChange: p.smallint(),
		map: p.string().length(50),
		stream: () => p.manyToOne(Stream),
		channel: () => p.manyToOne(Channel),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date())
	}
})

class Match extends MatchSchema.class {}
MatchSchema.setClass(Match)

export default Match;