export interface SplitMember {
  id: string;
  name: string;
}

function matchesMember(value: string, member: SplitMember) {
  return value === member.id || value === member.name;
}

export function splitIncludesMember(
  splitAmong: string[] | undefined,
  member: SplitMember,
) {
  return (
    !splitAmong?.length ||
    splitAmong.some((value) => matchesMember(value, member))
  );
}

export function toggleSplitMember(
  splitAmong: string[] | undefined,
  members: SplitMember[],
  memberId: string,
) {
  const member = members.find((candidate) => candidate.id === memberId);
  if (!member) return splitAmong || [];

  const current = splitAmong?.length
    ? splitAmong
    : members.map((candidate) => candidate.id);
  const included = current.some((value) => matchesMember(value, member));
  const next = included
    ? current.filter((value) => !matchesMember(value, member))
    : [...current, member.id];

  // An empty list means everyone in persisted expense data, so never let a
  // final deselection silently turn back into an all-person split.
  const selectedMembers = members.filter((candidate) =>
    next.some((value) => matchesMember(value, candidate)),
  );
  if (!selectedMembers.length) return current;

  // Keep the existing compact representation when every trip member is in.
  return selectedMembers.length === members.length ? [] : next;
}
