/**
 * @license INTERNAL ONLY — Surface manager hook
 *
 * Why: Keep Nova's layout deterministic while allowing operators to rearrange surfaces without mutating global state.
 * What: Exposes a reducer-backed API that tracks every surface, its placement, and active selection per region.
 * How: Normalizes definitions into state, enforces Guard → Do → Verify on every transition, and returns memoized helpers.
 */

import { useCallback, useMemo, useReducer } from "react";
import type {
	ActiveByPlacement,
	Placement,
	SurfaceDefinition,
	SurfaceId,
	SurfaceState,
} from "@/modules/layout/layoutTypes";

interface SurfaceManagerState {
	readonly surfaces: SurfaceState[];
	readonly active: ActiveByPlacement;
}

type SurfaceManagerAction =
	| { readonly type: "SET_PLACEMENT"; readonly id: SurfaceId; readonly placement: Placement }
	| { readonly type: "ACTIVATE"; readonly id: SurfaceId; readonly targetPlacement?: Exclude<Placement, "hidden"> }
	| { readonly type: "REORDER"; readonly id: SurfaceId; readonly direction: "forward" | "backward" };

interface SurfaceManagerApi {
	readonly surfaces: SurfaceState[];
	readonly active: ActiveByPlacement;
	readonly surfacesByPlacement: (placement: Exclude<Placement, "hidden">) => SurfaceState[];
	readonly activate: (id: SurfaceId, placementOverride?: Exclude<Placement, "hidden">) => void;
	readonly setPlacement: (id: SurfaceId, placement: Placement) => void;
	readonly reorder: (id: SurfaceId, direction: "forward" | "backward") => void;
}

const ACTIVE_TEMPLATE: ActiveByPlacement = Object.freeze({ primary: null, right: null, bottom: null });

function initState(definitions: SurfaceDefinition[]): SurfaceManagerState {
const normalized = prepareDefinitions(definitions);
const surfaces: SurfaceState[] = normalized.map((definition) => ({
...definition,
placement: definition.initialPlacement ?? definition.defaultPlacement,
}));

	const active = surfaces.reduce<ActiveByPlacement>((acc, surface) => {
		if (surface.placement === "hidden") return acc;
		if (!acc[surface.placement]) {
			acc[surface.placement] = surface.id;
		}
		return acc;
	}, { ...ACTIVE_TEMPLATE });

	return { surfaces, active };
}

	function prepareDefinitions(definitions: SurfaceDefinition[]): SurfaceDefinition[] {
	const seen = new Set<SurfaceId>();

	return definitions.map((definition) => {
	if (seen.has(definition.id)) {
	throw new Error(`Duplicate surface id detected: ${definition.id}`);
	}
	seen.add(definition.id);

	if (definition.defaultPlacement === "hidden") {
		throw new Error(`Surface ${definition.id} cannot default to hidden placement`);
	}

	return definition;
	});
	}

function surfaceManagerReducer(state: SurfaceManagerState, action: SurfaceManagerAction): SurfaceManagerState {
	switch (action.type) {
		case "SET_PLACEMENT": {
			const previousSurface = state.surfaces.find((surface) => surface.id === action.id);
			if (!previousSurface || previousSurface.placement === action.placement) {
				return state;
			}

			const surfaces = state.surfaces.map((surface) =>
				surface.id === action.id ? { ...surface, placement: action.placement } : surface,
			);

			const active: ActiveByPlacement = { ...state.active };

			if (previousSurface.placement !== "hidden" && active[previousSurface.placement] === action.id) {
				const fallback = surfaces.find(
					(surface) => surface.placement === previousSurface.placement && surface.id !== action.id,
				);
				active[previousSurface.placement] = fallback?.id ?? null;
			}

			if (action.placement !== "hidden") {
				active[action.placement] = action.id;
			}

			return { surfaces, active };
		}
		case "ACTIVATE": {
			const target = state.surfaces.find((surface) => surface.id === action.id);
			if (!target) return state;

			const placement = target.placement === "hidden" ? action.targetPlacement ?? target.defaultPlacement ?? "primary" : target.placement;
			const normalized = placement === "hidden" ? "primary" : placement;

			if (target.placement !== normalized) {
				return surfaceManagerReducer(state, { type: "SET_PLACEMENT", id: action.id, placement: normalized });
			}

			if (state.active[normalized] === action.id) {
				return state;
			}

			return {
				surfaces: state.surfaces,
				active: { ...state.active, [normalized]: action.id },
			};
		}
		case "REORDER": {
			const target = state.surfaces.find((surface) => surface.id === action.id);
			if (!target || target.placement === "hidden") {
				return state;
			}

			const indices = state.surfaces
				.map((surface, index) => ({ surface, index }))
				.filter(({ surface }) => surface.placement === target.placement);

			const currentIndex = indices.findIndex(({ surface }) => surface.id === action.id);
			if (currentIndex === -1) return state;

			const swapIndex = action.direction === "forward" ? currentIndex + 1 : currentIndex - 1;
			if (swapIndex < 0 || swapIndex >= indices.length) {
				return state;
			}

			const mutable = [...state.surfaces];
			const first = indices[currentIndex].index;
			const second = indices[swapIndex].index;
			const tmp = mutable[first];
			mutable[first] = mutable[second];
			mutable[second] = tmp;

			return { surfaces: mutable, active: state.active };
		}
		default:
			return state;
	}
}

export function useSurfaceManager(definitions: SurfaceDefinition[]): SurfaceManagerApi {
	const [state, dispatch] = useReducer(surfaceManagerReducer, definitions, initState);

	const surfacesByPlacement = useCallback(
		(placement: Exclude<Placement, "hidden">) =>
			state.surfaces.filter((surface) => surface.placement === placement),
		[state.surfaces],
	);

	const activate = useCallback(
		(id: SurfaceId, placementOverride?: Exclude<Placement, "hidden">) => {
			dispatch({ type: "ACTIVATE", id, targetPlacement: placementOverride });
		},
		[],
	);

	const setPlacement = useCallback(
		(id: SurfaceId, placement: Placement) => {
			dispatch({ type: "SET_PLACEMENT", id, placement });
		},
		[],
	);

	const reorder = useCallback(
		(id: SurfaceId, direction: "forward" | "backward") => {
			dispatch({ type: "REORDER", id, direction });
		},
		[],
	);

	const surfaces = useMemo(() => state.surfaces, [state.surfaces]);
	const active = useMemo(() => state.active, [state.active]);

	return {
		surfaces,
		active,
		surfacesByPlacement,
		activate,
		setPlacement,
		reorder,
	};
}

