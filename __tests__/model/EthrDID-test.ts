import { EthrDID } from "../../src/model/EthrDID";

describe(EthrDID, () => {
	it("should accept well formed keyAddress", () => {
		expect(() => EthrDID.fromKeyAddress("0x0123456789012345678901234567890123456789")).not.toThrow();
	});

	it("should accept well formed did", () => {
		expect(() => EthrDID.fromDID("did:ethr:0x0123456789012345678901234567890123456789")).not.toThrow();
	});

	it("should check did prefix", () => {
		expect(() => EthrDID.fromDID("___:ethr:0x0123456789012345678901234567890123456789")).toThrow();
	});

	it("should check did method", () => {
		expect(() => EthrDID.fromDID("did:web:0x0123456789012345678901234567890123456789")).toThrow();
	});

	it("should check length", () => {
		expect(() => EthrDID.fromKeyAddress("0x123")).toThrow();
	});

	it("should convert keyAddress to did", () => {
		const keyAddress = "0x0123456789012345678901234567890123456789";
		expect(EthrDID.fromKeyAddress(keyAddress).did()).toStrictEqual(`did:ethr:${keyAddress}`);
	});

	it("should convert did to keyAddress", () => {
		const keyAddress = "0x0123456789012345678901234567890123456789";
		expect(EthrDID.fromDID(`did:ethr:${keyAddress}`).keyAddress()).toStrictEqual(keyAddress);
	});
});
