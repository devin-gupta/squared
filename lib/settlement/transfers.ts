export interface Settlement {
  from: string;
  to: string;
  amount: number;
  fromId?: string;
  toId?: string;
}
export interface SettlementMember {
  id: string;
  name: string;
}

export function involvesMember(
  transfer: Settlement,
  side: "from" | "to",
  member: SettlementMember,
): boolean {
  const id = side === "from" ? transfer.fromId : transfer.toId;
  return id ? id === member.id : transfer[side] === member.name;
}

/** Sum the displayed transfer amounts, in cents, so the summary reconciles exactly. */
export function settlementTotals(
  transfers: Settlement[],
  member: SettlementMember,
) {
  let incoming = 0,
    outgoing = 0,
    incomingCount = 0,
    outgoingCount = 0;
  for (const transfer of transfers) {
    const cents = Math.round(transfer.amount * 100);
    if (involvesMember(transfer, "to", member)) {
      incoming += cents;
      incomingCount++;
    }
    if (involvesMember(transfer, "from", member)) {
      outgoing += cents;
      outgoingCount++;
    }
  }
  return {
    incoming: incoming / 100,
    outgoing: outgoing / 100,
    net: (incoming - outgoing) / 100,
    incomingCount,
    outgoingCount,
  };
}
