function Foo({ updates }: { updates: Array<Record<string, unknown>> }) {
  return (
    <div>
      {(() => {
        const timelineEntries: Array<
          | { type: "update"; date: string; update: Record<string, unknown> }
          | { type: "achievement"; date: string; achievement: Record<string, unknown> }
        > = [
          ...updates.map((u) => ({ type: "update" as const, date: u.created_at as string, update: u })),
        ].sort((a, b) => 0);
        return (
          <div>
            {timelineEntries.map((entry) =>
              entry.type === "update" ? (
                <div key="a">u</div>
              ) : (
                <div key="b">a</div>
              )
            )}
          </div>
        );
      })()}
    </div>
  );
}
export default Foo;
