import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.GAS_WEB_APP_URL || "";

function buildGetUrl(searchParams: URLSearchParams) {
  return `${APPS_SCRIPT_URL}?${searchParams.toString()}`;
}

async function parseAppsScriptResponse(response: Response) {
  const text = await response.text();

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({
      success: false,
      message: "Apps Script 응답이 JSON 형식이 아닙니다.",
      raw: text,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        {
          success: false,
          message: "GAS_WEB_APP_URL이 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = (searchParams.get("action") || "").trim();

    const allowedActions = ["members", "schedules", "memos"];

    if (!allowedActions.includes(action)) {
      return NextResponse.json({
        success: false,
        message: "잘못된 요청입니다.",
      });
    }

    const response = await fetch(buildGetUrl(searchParams), {
      method: "GET",
      cache: "no-store",
    });

    return await parseAppsScriptResponse(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "GET 요청 처리 중 오류가 발생했습니다.",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json(
        {
          success: false,
          message: "GAS_WEB_APP_URL이 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const action = String(body?.action || "").trim();

    const allowedActions = [
      "saveSchedule",
      "deleteSchedule",
      "saveMemo",
      "deleteMemo",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json({
        success: false,
        message: "잘못된 요청입니다.",
      });
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return await parseAppsScriptResponse(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "POST 요청 처리 중 오류가 발생했습니다.",
    });
  }
}
