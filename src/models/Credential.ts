import { defineEntity, p } from "@mikro-orm/core";

const CredentialSchema = defineEntity({
	name: 'Credential',
	properties:{
		id: p.bigint().unsigned().autoincrement().primary(),
		type: p.enum(['bot', 'broadcaster']).default('broadcaster'),
		twitchId: p.string().length(50).index(),
		accessToken: p.string().length(50),
		refreshToken: p.string().length(50),
		expiresAt: p.datetime(),
		createdAt: p.datetime().onCreate(() => new Date()),
		updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date())
	}
})

class Credential extends CredentialSchema.class {}
CredentialSchema.setClass(Credential)

export default Credential;
