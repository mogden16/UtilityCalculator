export const TON_TO_BTUH = 12_000;
export const BTU_PER_KW = 3_412.142;
export const BTU_PER_HP = 2_544.4336;
export const BTU_PER_THERM = 100_000;
export const BTU_PER_DTH = 1_000_000;
export const DEFAULT_HHV_MMBTU_PER_MCF = 1.035;

export function tonsToBtuh(tons: number): number {
  return tons * TON_TO_BTUH;
}

export function btuhToTons(btuh: number): number {
  return btuh / TON_TO_BTUH;
}

export function btuhToKw(btuh: number): number {
  return btuh / BTU_PER_KW;
}

export function kwToBtuh(kw: number): number {
  return kw * BTU_PER_KW;
}

export function btuhToHp(btuh: number): number {
  return btuh / BTU_PER_HP;
}

export function hpToBtuh(hp: number): number {
  return hp * BTU_PER_HP;
}

export function btuhToThermPerHour(btuh: number): number {
  return btuh / BTU_PER_THERM;
}

export function thermPerHourToBtuh(thermPerHour: number): number {
  return thermPerHour * BTU_PER_THERM;
}

export function btuhToDthPerHour(btuh: number): number {
  return btuh / BTU_PER_DTH;
}

export function dthPerHourToBtuh(dthPerHour: number): number {
  return dthPerHour * BTU_PER_DTH;
}

export function btuhToDth(btuh: number): number {
  return btuh / BTU_PER_DTH;
}

export function btuhToCFH(btuh: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  const btusPerCubicFoot = hhvMMBtuPerMcf * 1_000;
  return btuh / btusPerCubicFoot;
}

export function cfhToBtuh(cfh: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  const btusPerCubicFoot = hhvMMBtuPerMcf * 1_000;
  return cfh * btusPerCubicFoot;
}

export function btuhToMcfPerHour(btuh: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  return btuhToCFH(btuh, hhvMMBtuPerMcf) / 1_000;
}

export function mcfPerHourToBtuh(mcfPerHour: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  return cfhToBtuh(mcfPerHour * 1_000, hhvMMBtuPerMcf);
}

export function mcfToDth(mcf: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  return mcf * hhvMMBtuPerMcf;
}

export function dthToMcf(dth: number, hhvMMBtuPerMcf = DEFAULT_HHV_MMBTU_PER_MCF): number {
  return hhvMMBtuPerMcf !== 0 ? dth / hhvMMBtuPerMcf : 0;
}
