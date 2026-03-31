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

export interface StreamListItem {
	id: number;
	twitchId: string;
	title: string;
	startedAt: Date;
	endedAt: Date | null;
	matchCount: number;
	totalRr: number;
}

export interface StreamsPageResult {
	streams: StreamListItem[];
	page: number;
	totalPages: number;
	totalStreams: number;
}

export interface MatchListItem {
	id: number;
	rank: string;
	rr: number;
	rrChange: number;
	map: string;
	createdAt: Date;
}

export interface MatchesPageResult {
	matches: MatchListItem[];
	page: number;
	totalPages: number;
	totalMatches: number;
}
