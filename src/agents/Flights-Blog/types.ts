import { Type, type Static } from "@sinclair/typebox";

export const FlightInfo = Type.Object({
	id: Type.String(),
	distance: Type.Number(),
	score: Type.Number(),
	type: Type.String(),
	started: Type.Number(),
	ended: Type.Number(),
	site: Type.Object({
		id: Type.Number(),
		name: Type.String(),
	}),
});
export type FlightInfoType = Static<typeof FlightInfo>;

export const HikeInfo = Type.Object({
	id: Type.String(),
	distance: Type.Number(),
	gain: Type.Number(),
	started: Type.Number(),
	ended: Type.Number(),
});
export type HikeInfoType = Static<typeof HikeInfo>;

export const SingleTrack = Type.Object({
	id: Type.String(),
	pilot: Type.Object({
		id: Type.String(),
		name: Type.String(),
		username: Type.String(),
		civl: Type.Optional(Type.Number()),
	}),
	category: Type.String(),
	started: Type.Number(),
	ended: Type.Number(),
	hikes: Type.Array(HikeInfo),
	flights: Type.Array(FlightInfo),
	wing: Type.String(),
	mode: Type.Union([Type.Literal("h"), Type.Literal("f"), Type.Literal("h&f")]),
	comments: Type.Number(),
	likes: Type.Number(),
	liked: Type.Optional(Type.Boolean()),
	commented: Type.Optional(Type.Boolean()),
	private: Type.Optional(Type.Boolean()),
	toGoal: Type.Optional(Type.Number()),
	atGoal: Type.Number(),
	wpts: Type.Number(),
	essTs: Type.Optional(Type.Number()),
	taskStart: Type.Optional(Type.Number()),
	taskId: Type.Optional(Type.String()),
	esid: Type.Optional(Type.String()),
	thermalCount: Type.Number(),
});
export type SingleTrackType = Static<typeof SingleTrack>;

export const BestTracksResponse = Type.Object({
	success: Type.Boolean(),
	data: Type.Object({
		tracks: Type.Array(SingleTrack),
		total: Type.Number(),
		date: Type.String(),
	}),
});

export type BestTracksResponseType = Static<typeof BestTracksResponse>;

export const NormalizedTrack = Type.Object({
	id: Type.String(),
	image_link: Type.String(),
	pilot_name: Type.String(),
	track_link: Type.String(),
	profile_link: Type.String(),
	site: Type.String(),
	type: Type.String(),
	distance: Type.Number(),
	duration: Type.String(),
	waypoint_count: Type.Number(),
	made_goal: Type.Boolean(),
	glider_name: Type.String(),
	flight_count: Type.Number(),
	hike_count: Type.Number(),
	thermal_count: Type.Number(),
});
export type NormalizedTrackType = Static<typeof NormalizedTrack>;
