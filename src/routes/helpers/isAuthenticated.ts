import { FastifyReply, FastifyRequest } from "fastify";

const isAuthenticated = <TReq extends FastifyRequest, TResp extends FastifyReply>(
	handler: (req: TReq, resp: TResp) => Promise<unknown>
) => {
	return async (req: TReq, resp: TResp) => {
		if(!req.session.channel) {
			return resp.redirect('/dashboard/login')
		}

		return handler(req, resp)
	}
}

export default isAuthenticated;
