import { FastifyReply, FastifyRequest } from "fastify";

const isAuthenticated = (
	handler: (req: FastifyRequest, resp: FastifyReply) => Promise<unknown>
) => {
	return async (req: FastifyRequest, resp: FastifyReply) => {
		if(!req.session.channel) {
			return resp.redirect('/dashboard/login')
		}

		return handler(req, resp)
	}
}

export default isAuthenticated;
