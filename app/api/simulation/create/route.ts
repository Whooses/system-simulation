import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, connections, scenario } = body;

    if (!nodes || !connections || !scenario) {
      return NextResponse.json(
        { error: "Missing required fields: nodes, connections, scenario" },
        { status: 400 },
      );
    }

    const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({ simulationId, nodes: nodes.length, connections: connections.length });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
