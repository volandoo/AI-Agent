import type { AgentRequest, AgentResponse, AgentContext } from "@agentuity/sdk";
import { Type, type Static } from "@sinclair/typebox";
import OpenAI from "openai";


const TrackObject = Type.Object({
	id: Type.String(),
	pilot_name: Type.String(),
	site: Type.String(),
	type: Type.String(),
	distance: Type.Number(),
	duration: Type.String(),
	waypoint_count: Type.Optional(Type.Number()),
	made_goal: Type.Optional(Type.Boolean()),
	km_to_goal: Type.Optional(Type.Number()),
	thermal_count: Type.Number(),
	glide_count: Type.Number(),
	total_tracks_this_year: Type.Number(),
	is_comp: Type.Boolean(),
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
	Volandoo is a location-based live tracking platform for hang gliding and paragliding. It also has a logbook for the 
	pilots to keep a history of their actvities. These activities are called "tracks", and these can be either "flight" or "hike & fly" tracks.

	This pilot just finished their activity and you're given the track. Your job is to write a brief summary of this activity. In the payload you
	will find the number of tracks they have recorded with Volandoo so far this year. You should use this information if you can.
	`;

	const prompt = `Here is the track in json format: 
	\`\`\`json
	${JSON.stringify(track)}
	\`\`\`

	Return the summary in markdown format, don't make it more than 6 sentences long. If the "site" is unknown, don't mention it.
	If "is_comp" is true, this is part of a competition, otherwise it free flight, don't mention anything related to comps if it's not a comp.
	`;

	const completion = await client.chat.completions.create({
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: prompt },
		],
		model: "gpt-4.1-mini",
	});

	let message = completion.choices[0]?.message?.content;
	if (message) {
		return resp.json({
			success: true,
			message,
		});
	}

	return resp.json({
		success: false,
		message: 'Something went wrong',
	});
}