export interface OAuthTokenResponse {
	access_token: string;
	expires_in: number
}

export interface OAuthRefreshTokenResponse extends OAuthTokenResponse {
	refresh_token: string
}

export interface OAuthValidateResponse {
	user_id: string
	scopes: string[]
}

export interface UserInfoResponse {
	data: {
		id: string;
		display_name: string;
		email: string;
	}[]
}
