import type { AgentRequest, AgentResponse, AgentContext } from "@agentuity/sdk";
import { Type, type Static } from "@sinclair/typebox";
import OpenAI from "openai";


const TrackObject = Type.Object({
	id: Type.String(),
	pilot_name: Type.String(),
	site: Type.String(),
	type: Type.String(),
	distance: Type.Number(),
	duration_seconds: Type.Number(),
	waypoint_count: Type.Number(),
	made_goal: Type.Boolean(),
	km_to_goal: Type.Number(),
	thermal_count: Type.Number(),
	glide_count: Type.Number(),
	total_tracks_this_year: Type.Number(),
	date: Type.String(),
});

type TrackObjectType = Static<typeof TrackObject>;


const client = new OpenAI();

export default async function Agent(
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext,
) {

	const track = await req.data.object<TrackObjectType>();

	const system = `
	Volandoo is a location-based live tracking platform for hang gliding and paragliding. It also has a logbooks for the 
	pilots to keep a history of their tracks, these can be either "flight" or "hike & fly" tracks.

	You are given a track from a pilot, this pilot just finished their activity. Your job is to write a brief summary of
	the track. You are also given a number of tracks they have recorded with Volandoo so far this year. You should use this
	information to write a brief summary of the track. This should not be more than 6 sentences. Only output markown.
	`;

	const prompt = `Here is the track in json format: ${JSON.stringify(track)}`;

	const completion = await client.chat.completions.create({
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: prompt },
		],
		model: "gpt-4.1-mini",
	});
	let message = completion.choices[0]?.message?.content;


	if (message) {
		await fetch(`https://api.volandoo.com/v1/tracks/${track.id}/brief`, {
			method: "POST",
			body: JSON.stringify({
				brief: message,
			}),
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		});
		return resp.text(message);
	}

	return resp.text('Something went wrong');
}