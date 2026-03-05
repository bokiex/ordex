/**
 * Canonical UOM values. All UOMs should be normalized to uppercase.
 *
 * Valid values: CTN, PKT, KG, PCS, ROLL, TUBE, TUB, DRUM, EACH, BTL
 */

const UOM_MAP: Record<string, string> = {
	ctn: "CTN",
	carton: "CTN",
	pkt: "PKT",
	packet: "PKT",
	kg: "KG",
	kilogram: "KG",
	pc: "PCS",
	pcs: "PCS",
	piece: "PCS",
	roll: "ROLL",
	tube: "TUBE",
	tub: "TUB",
	drum: "DRUM",
	each: "EACH",
	btl: "BTL",
	bottle: "BTL",
};

/** Normalize a UOM string to uppercase canonical form. */
export function normalizeUom(uom: string | null | undefined): string {
	if (!uom) return "PKT";
	const key = uom.trim().toLowerCase();
	return UOM_MAP[key] ?? uom.toUpperCase();
}
