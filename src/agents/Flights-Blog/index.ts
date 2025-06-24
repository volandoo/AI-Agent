import type {
	AgentRequest,
	AgentResponse,
	AgentContext,
	Json,
} from "@agentuity/sdk";
import dayjs from "dayjs";
import OpenAI from "openai";
import { type BestTracksResponseType, type NormalizedTrackType } from "./types";

const client = new OpenAI();

const normalizeDuration = (ms: number) => {
	const hours = Math.floor(ms / 3600000);
	const minutes = Math.floor((ms % 3600000) / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${hours}h ${minutes}m ${seconds}s`;
};

const capitalizeFirstLetterOfEachWord = (str: string) => {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

export default async function Agent(
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) {
	const from = dayjs().subtract(1, "week").startOf("day").valueOf();
	const to = dayjs().endOf("day").valueOf();

	const bestTracks = await fetch(
		`https://api.volandoo.com/v1/tracks/best?from=${from}&to=${to}&limit=${12}`,
		{
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		}
	).then((res) => res.json() as Promise<BestTracksResponseType>);




	const normalizedTracks = bestTracks.data.tracks
		.map((t) => {
			const firstFlight = t.flights[0];
			if (!firstFlight) {
				return null;
			}
			return {
				id: t.id,
				image_link: `https://ik.imagekit.io/tcixzkbxb/prod/screenshots/${t.id}.jpg`,
				pilot_name: t.pilot.name,
				track_link: `https://volandoo.com/tracks/${t.id}`,
				profile_link: `https://volandoo.com/pilots/${t.pilot.id}`,
				site: capitalizeFirstLetterOfEachWord(firstFlight.site.name),
				type:
					t.wpts > 0
						? "competition"
						: t.mode === "h&f"
							? "Hike & Fly"
							: capitalizeFirstLetterOfEachWord(firstFlight.type ?? "Unknown"),
				distance: [
					...t.flights.map((f) => f.distance),
					...t.hikes.map((h) => h.distance),
				].reduce((a, b) => a + b, 0),
				duration: normalizeDuration(t.ended - t.started),
				waypoint_count: t.wpts > 0 ? t.wpts : undefined,
				made_goal: t.wpts > 0 ? t.atGoal > 0 : undefined,
				flight_count: t.flights.length,
				hike_count: t.hikes.length,
				glider_name: t.wing,
				thermal_count: t.thermalCount,
			};
		})
		.filter(Boolean) as NormalizedTrackType[];



	const memories = await fetch("https://api.volandoo.com/v1/blog/memory?limit=3", {
		headers: {
			"x-secret-key": process.env.SERVER_KEY ?? "",
		},
	}).then(res => res.json() as Promise<{ data: { memory_text: string }[] }>);

	const memoryContext = memories.data.map(m => `- ${m.memory_text}`).join("\n");



	const system = `
You are a blogger for Volandoo. Volandoo is a live tracking platform for hang gliding and paragliding. It also has a logbooks for the pilots to keep
track of their flights. Not only this, but Volandoo is also a social network where pilots can comment and like each other's flights.

${memoryContext.length > 0 ? `Keep in mind the recent blog themes:
	${memoryContext}
You aim to maintain tone consistency, avoid repeating phrasing from recent posts, and bring fresh perspective each week.
` : ""}
`;
	const prompt = `
Write a weekly blog post summarizing the top 6 paragliding and hang gliding flights from the Volandoo platform. 
This blog post is for SEO purposes and will be published on the Volandoo website. Optimize the content for relevant keywords such as:
"paragliding", "hang gliding", "XC flights", "track log", "top pilots", and site names (like "Annecy", "Medellín", etc.).

The structure of the post should be:
1. **Introduction (3-4 sentences)**: Briefly explain what Volandoo is, mention the week's activity and how many total flights were uploaded. Mention that the platform tracks XC flights globally and that this list celebrates the top 6.
2. **Flight Highlights (1 paragraph per flight)**: For each flight, include:
   - Pilot name (linked to their profile)
   - Glider name
   - Flight type (e.g. XC, competition, hike & fly)
   - Site name
   - Distance
   - Duration
   - Waypoints (if any)
   - Whether the pilot reached goal (for competition flights)
   - Any other notable details (e.g. number of thermals, hike count)
   - Embed a clickable image linking to the track

Vary your phrasing and make the tone friendly, community-driven, and slightly journalistic. Each paragraph should be unique and highlight the pilot's achievement in an enthusiastic but SEO-friendly way.

This is the week of ${new Date(from).toDateString()}, and although we're showcasing only 6 flights, there were ${bestTracks.data.total
		} total flights on Volandoo this week. Mention this in the intro.

Use **Markdown format** for the output. Make the image markdown include descriptive alt text for SEO. For example:

\`[![Flight from Annecy by John Doe](https://example.jpg)](https://volandoo.com/tracks/trackId)\`

Respond with a JSON object using the following exact format:

{
  "title": "Short catchy blog title with keywords",
  "brief": "2-3 sentence summary of the week's activity with key terms",
  "content": "The blog post content in markdown",
  "image": "Image URL of the first flight's screenshot"
}

Only include the JSON response. No commentary or prose around it.

Here are the tracks:

${JSON.stringify(normalizedTracks)}
`;


	const completion = await client.chat.completions.create({
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: prompt },
		],
		model: "gpt-4.1-mini",
	});
	let message = completion.choices[0]?.message?.content;

	if (message?.startsWith("```json")) {
		// remove first 7 characters
		message = message.slice(7);
	}
	if (message?.endsWith("```")) {
		// remove last 3 characters
		message = message.slice(0, -3);
	}

	const json = JSON.parse(message ?? "{}");

	if (json.title && json.brief && json.content && json.image) {
		const response = await fetch("https://api.volandoo.com/v1/blog", {
			method: "POST",
			body: JSON.stringify({
				title: json.title,
				brief: json.brief,
				content: json.content,
				image: json.image,
				author: "Volandoo AI",
			}),
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		}).then((res) => res.json());



		const memorySummaryPrompt = `
			Summarize this blog post into a short memory note for future reference.

			The memory should include:
			- The week covered (e.g., "Week of June 17, 2025")
			- The main theme or trend (e.g., "XC flights with long distances", "many pilots reached goal")
			- Any standout flights or names mentioned
			- Any change in tone or writing style

			Keep it under 100 words. Format as plain text, no markdown.

			Blog Post:
			Title: ${json.title}
			Brief: ${json.brief}
			Content: ${json.content}
			`;

		const memorySummary = await client.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{ role: "user", content: memorySummaryPrompt }
			]
		});

		const memoryText = memorySummary.choices[0]?.message?.content ?? "";

		await fetch("https://api.volandoo.com/v1/blog/memory", {
			method: "POST",
			body: JSON.stringify({
				week_start: from,
				memory_text: memoryText,
				title: json.title
			}),
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		});


		return resp.json(response as Json);
	}

	return resp.text("Something went wrong");
}
