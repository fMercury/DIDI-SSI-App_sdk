import Credentials from "uport-credentials/lib/Credentials";

import { VerifiableSpecIssuerSelector } from "./common/SelectiveDisclosureSpecs";

import { ClaimData } from "../model/Claim";
import { CredentialDocument } from "../model/CredentialDocument";
import { DidiDocument } from "../model/DidiDocument";
import { EthrDID } from "../model/EthrDID";
import { Identity } from "../model/Identity";

import { SelectiveDisclosureRequest } from "./SelectiveDisclosureRequest";

/**
 * Mensaje que responde a un SelectiveDisclosureRequest, incluyendo el request
 * original y los datos solicitados en el mismo (verificados y no)
 */
export interface SelectiveDisclosureResponse extends DidiDocument {
	type: "SelectiveDisclosureResponse";

	/** Destinatario de esta respuesta */
	subject: EthrDID;

	/** JWT de la peticion */
	requestToken: string;

	/** Pares clave/valor no verificados solicitados en la peticion */
	ownClaims: ClaimData;

	/** Array de JWTs solicitados en la peticion */
	verifiedClaims: string[];
}

function selectOwnClaims(
	request: SelectiveDisclosureRequest,
	identity: Identity
): { ownClaims: ClaimData; missingRequired: string[] } {
	const ownClaims: ClaimData = {};
	const missingRequired: string[] = [];

	function insert(key: string, value: string | null | undefined) {
		if (value) {
			ownClaims[key] = value;
		}
	}

	Object.entries(request.ownClaims).forEach(([key, data]) => {
		switch (key.toLowerCase()) {
			case "nombre":
			case "names":
			case "firstnames":
				insert(key, identity.personalData.firstNames);
				break;
			case "apellido":
			case "lastnames":
				insert(key, identity.personalData.lastNames);
				break;
			case "dni":
			case "document":
				insert(key, identity.personalData.document);
				break;
			case "name":
			case "full name":
				if (identity.personalData.firstNames && identity.personalData.lastNames) {
					insert(key, `${identity.personalData.firstNames} ${identity.personalData.lastNames}`);
				}
				break;
			case "email":
				insert(key, identity.email);
				break;
			case "country":
			case "nationality":
				insert(key, identity.personalData.nationality);
				break;
			case "cellphone":
			case "phone":
				insert(key, identity.cellPhone);
				break;
			case "street":
			case "streetaddress":
				insert(key, identity.address.street);
				break;
			case "numberstreet":
			case "addressnumber":
				insert(key, identity.address.number);
				break;
			case "department":
				insert(key, identity.address.department);
				break;
			case "floor":
				insert(key, identity.address.floor);
				break;
			case "city":
			case "neighborhood":
				insert(key, identity.address.neighborhood);
				break;
			case "zipcode":
			case "postcode":
				insert(key, identity.address.postCode);
				break;
			default:
				break;
		}
		if (ownClaims[key] === undefined && data.essential) {
			missingRequired.push(key);
		}
	});
	return { ownClaims, missingRequired };
}

function matchesIssuerSelector(document: CredentialDocument, selector?: VerifiableSpecIssuerSelector): boolean {
	if (selector === undefined) {
		return true;
	}

	return selector.find(sel => sel.did.did() === document.issuer.did()) !== undefined;
}

function selectVerifiedClaims(
	ownDid: EthrDID,
	request: SelectiveDisclosureRequest,
	documents: CredentialDocument[]
): { verifiedClaims: CredentialDocument[]; missingRequired: string[] } {
	const verifiedClaims: CredentialDocument[] = [];
	const missingRequired: string[] = [];

	Object.entries(request.verifiedClaims).forEach(([title, selector]) => {
		const candidates = documents
			.filter(doc => doc.subject.did() === ownDid.did())
			.map(doc => [doc, ...doc.nested])
			.reduce((acc, curr) => [...acc, ...curr], []);
		const selected = candidates.find(
			document =>
				title === document.title &&
				(selector.jwt === undefined || selector.jwt === document.jwt) &&
				matchesIssuerSelector(document, selector.iss)
		);
		if (selected) {
			verifiedClaims.push(selected);
		} else if (selector.essential) {
			missingRequired.push(title);
		}
	});

	return { verifiedClaims, missingRequired };
}

export const SelectiveDisclosureResponse = {
	...DidiDocument,

	/**
	 * Obtiene los datos a insertar en una respuesta (SelectiveDisclosureResponse.signJWT)
	 * y los datos requeridos faltantes
	 */
	getResponseClaims(
		ownDid: EthrDID,
		request: SelectiveDisclosureRequest,
		documents: CredentialDocument[],
		identity: Identity
	): { missingRequired: string[]; ownClaims: ClaimData; verifiedClaims: CredentialDocument[] } {
		const verified = selectVerifiedClaims(ownDid, request, documents);
		const own = selectOwnClaims(request, identity);

		return {
			missingRequired: [...own.missingRequired, ...verified.missingRequired],
			ownClaims: own.ownClaims,
			verifiedClaims: verified.verifiedClaims
		};
	},

	/**
	 * Crea un JWT firmado que contiene un SelectiveDisclosureResponse
	 */
	async signJWT(
		credentials: Credentials,
		request: SelectiveDisclosureRequest,
		ownClaims: ClaimData,
		verifiedClaims: CredentialDocument[]
	): Promise<string> {
		return credentials.createDisclosureResponse({
			sub: request.issuer.did(),
			req: request.jwt,
			own: ownClaims,
			verified: verifiedClaims.map(doc => doc.jwt)
		});
	},

	/**
	 * Envia un JWT de SelectiveDisclosureResponse en el formato esperado
	 * para el transporte REST.
	 */
	async submit(args: { callback: string; token: string }) {
		return fetch(args.callback, {
			method: "POST",
			headers: {
				"Content-Type": "application/json; charset=utf-8"
			},
			body: JSON.stringify({ access_token: args.token })
		});
	}
};
