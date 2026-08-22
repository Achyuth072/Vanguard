import { NextRequest, NextResponse } from "next/server";
import { getDiscoveryJobs } from "@/lib/discovery";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit") || searchParams.get("pageSize");
    const source = searchParams.get("source") || undefined;
    const feedSourceId = searchParams.get("feedSourceId") || undefined;
    const search = searchParams.get("search") || searchParams.get("q") || undefined;
    const sort = searchParams.get("sort") || undefined;
    const candidateId = searchParams.get("candidateId") || undefined;

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const result = await getDiscoveryJobs({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
      source,
      feedSourceId,
      search,
      sort,
      candidateId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("GET /api/discovery error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve discovery staged jobs",
      },
      { status: 500 }
    );
  }
}
