import { NextResponse } from "next/server";
import { ingestJobPipeline, type IngestionInput } from "@/lib/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawText = body.rawText || body.text || body.description;
    const url = body.url;
    const title = body.title;
    const company = body.company;

    if (!rawText && !url && (!title || !company)) {
      return NextResponse.json(
        {
          success: false,
          error: "At least job description text, posting URL, or title and company must be provided.",
        },
        { status: 400 }
      );
    }

    const input: IngestionInput = {
      rawText,
      url,
      title,
      company,
      location: body.location,
      remoteStatus: body.remoteStatus,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      employmentType: body.employmentType,
      description: body.description,
      requiredExperienceYears: body.requiredExperienceYears,
      source: body.source,
    };

    const result = await ingestJobPipeline(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Ingestion API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to ingest job posting",
      },
      { status: 500 }
    );
  }
}
