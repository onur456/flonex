import { asJsonRecord } from "@/lib/fal";
import { generateImageResponse } from "@/lib/generateFalMedia";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = asJsonRecord(await request.json().catch(() => ({})));
  return generateImageResponse(body);
}
