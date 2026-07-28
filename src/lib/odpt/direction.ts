export type TokaidoDirection = "inbound" | "outbound";

interface DirectionInput {
  odptDirection: string | null | undefined;
  fromStationId: string | null;
  toStationId: string | null;
  destinationStationIds: Array<string | null> | undefined;
  trainNumber: string;
}

function directionFromStationOrder(
  fromStationId: string | null,
  toStationId: string | null,
  stationOrder: readonly string[],
): TokaidoDirection | null {
  if (!fromStationId || !toStationId || fromStationId === toStationId) return null;

  const fromIndex = stationOrder.indexOf(fromStationId);
  const toIndex = stationOrder.indexOf(toStationId);
  if (fromIndex < 0 || toIndex < 0) return null;

  // 駅順は東京 → 横浜（下り）の順。
  return toIndex > fromIndex ? "outbound" : "inbound";
}

function directionFromTrainNumber(trainNumber: string): TokaidoDirection | null {
  const match = trainNumber.match(/^(\d+)/);
  if (!match) return null;

  // JR 東日本の東海道線は、偶数列車が上り・奇数列車が下り。
  return Number(match[1]) % 2 === 0 ? "inbound" : "outbound";
}

export function inferTokaidoDirection(
  input: DirectionInput,
  stationOrder: readonly string[],
): TokaidoDirection {
  const suffix = input.odptDirection?.split(/[.:]/).pop()?.toLowerCase() ?? "";
  if (suffix === "inbound") return "inbound";
  if (suffix === "outbound") return "outbound";

  // Challenge API では railDirection が空になる列車があるため、駅の移動順で補完する。
  const fromStations = directionFromStationOrder(
    input.fromStationId,
    input.toStationId,
    stationOrder,
  );
  if (fromStations) return fromStations;

  // 駅停車中など toStation が無い場合は、区間内の行先駅があればそこから補完する。
  const destinationStationId =
    input.destinationStationIds?.find((stationId): stationId is string => stationId !== null) ??
    null;
  const fromDestination = directionFromStationOrder(
    input.fromStationId,
    destinationStationId,
    stationOrder,
  );
  if (fromDestination) return fromDestination;

  // 直通先など行先が区間外でも、東海道線の列車番号規則で判定できる。
  return directionFromTrainNumber(input.trainNumber) ?? "outbound";
}
