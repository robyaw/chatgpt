// characterBoards.js
// Data-first character boards for Sonic Roll.
// NOTE: Some fine-print rule text in publicly available preview images is hard to read;
// fields marked TODO should be verified against the physical dashboards/rulebook.
//
// Sources for names/structure: dashboard previews. :contentReference[oaicite:1]{index=1}

export const DiceColor = {
  RED: "red",
  YELLOW: "yellow",
  BLUE: "blue",
  BLACK: "black",
};

// A dice spec is "roll these dice into the pool"
export function diceSpec(color, count) {
  return { color, count };
}

/**
 * RollAction shape:
 * {
 *   id: string,
 *   name: string,
 *   dice: Array<{color, count}>,
 *   maxRollIterations: number, // how many times you may roll for this action (and add/keep results per its rules)
 *   resolve: (ctx) => void,    // ctx is your game state wrapper; keep pure if you prefer
 *   notes?: string
 * }
 *
 * Ability shape:
 * {
 *   id: string,
 *   name: string,
 *   timing: "ANY_PLAYER" | "ON_YOUR_TURN" | "AVOID" | "SPEND" | "PASSIVE",
 *   uses: "ONCE_PER_TURN" | "TOKEN_REFRESH_START_OF_TURN" | "UNLIMITED" | string,
 *   apply: (ctx, payload) => void,
 *   notes?: string
 * }
 */

export const CharacterId = {
  SONIC: "sonic",
  TAILS: "tails",
  AMY: "amy",
  KNUCKLES: "knuckles",
};

export const characterBoards = {
  [CharacterId.SONIC]: {
    id: CharacterId.SONIC,
    name: "Sonic",
    ability: {
      id: "sonic_insta_shield",
      name: "Insta-Shield",
      timing: "AVOID",
      uses: "TOKEN_REFRESH_START_OF_TURN",
      apply(ctx, payload) {
        // TODO verify exact legality:
        // Preview text indicates you can exhaust the token to change a die’s color (and possibly nudge result by 1).
        // payload example: { dieIndex, changeToColor, delta }
        const { dieIndex, changeToColor, delta = 0 } = payload ?? {};
        const die = ctx.dicePool?.[dieIndex];
        if (!die) return;

        if (changeToColor) die.color = changeToColor;

        if (delta !== 0 && typeof die.value === "number") {
          let v = die.value + delta;
          // wrap 1..6
          while (v < 1) v += 6;
          while (v > 6) v -= 6;
          die.value = v;
        }

        ctx.exhaustAbilityToken?.(CharacterId.SONIC);
      },
      notes:
        "Preview shows: exhaust token to change a die’s color and optionally adjust its result by 1. TODO confirm exact icons/limits.",
    },
    rollActions: [
      {
        id: "sonic_super_peel_out",
        name: "Super Peel Out",
        dice: [diceSpec(DiceColor.BLUE, 6)], // shown as 6 blue dice in preview
        maxRollIterations: 1,
        resolve(ctx) {
          // Preview text: “Discard the lowest result(s) in your Dice Pool.”
          // TODO confirm whether “result(s)” means one die or all tied for lowest.
          const pool = ctx.dicePool ?? [];
          if (pool.length === 0) return;
          const min = Math.min(...pool.map(d => d.value));
          // Conservative: discard ONE lowest. Change to discard all tied lows if rules say so.
          const idx = pool.findIndex(d => d.value === min);
          if (idx >= 0) ctx.discardDieFromPool?.(idx);
        },
        notes: "Discard the lowest die result in your pool (TODO confirm ties handling).",
      },
      {
        id: "sonic_spin_dash",
        name: "Spin Dash",
        dice: [diceSpec(DiceColor.BLUE, 2), diceSpec(DiceColor.RED, 1)], // shown as 2 blue + 1 red in preview
        maxRollIterations: 999, // “repeat roll until …”
        resolve(ctx) {
          // Preview text: “Repeat Roll until 2 results in your Dice Pool match.”
          // This resolve assumes ctx performed the rolling loop; here we just validate.
          ctx.ensureAtLeastOnePairInPool?.();
        },
        notes:
          "Repeat rolling (and adding results) until you have at least one matching pair in your dice pool.",
      },
      {
        id: "sonic_third_action",
        name: "Dash (TODO name)",
        dice: [],
        maxRollIterations: 1,
        resolve(ctx) {
          // TODO: Sonic’s 3rd box is not fully legible from the preview image alone.
          // Add once you confirm the exact action name + dice + rule text.
        },
        notes:
          "TODO: Confirm Sonic’s third roll action name/dice/rules from physical dashboard/rulebook.",
      },
    ],
  },

  [CharacterId.TAILS]: {
    id: CharacterId.TAILS,
    name: "Tails",
    ability: {
      id: "tails_buddy_flight",
      name: "Buddy Flight",
      timing: "ANY_PLAYER",
      uses: "UNLIMITED", // TODO confirm (preview implies it’s a reusable ability using a spent die)
      apply(ctx, payload) {
        // Preview gist: Spend a die to help another player by shifting value.
        // payload: { spenderDieIndex, targetDieIndex, lowerBy }
        const { spenderDieIndex, targetDieIndex, lowerBy } = payload ?? {};
        const spender = ctx.dicePool?.[spenderDieIndex];
        const target = ctx.dicePool?.[targetDieIndex];
        if (!spender || !target) return;

        const n = Math.max(0, Math.min(5, lowerBy ?? 0));
        // Lower spender by n, raise target by n (wrap 1..6). TODO verify wrap rules.
        let s = spender.value - n;
        while (s < 1) s += 6;
        spender.value = s;

        let t = target.value + n;
        while (t > 6) t -= 6;
        target.value = t;

        ctx.markDieSpent?.(spenderDieIndex);
      },
      notes:
        "Preview indicates Tails can spend a die to lower its result by some amount, and add that amount to another die’s result. TODO confirm exact restrictions + setup die.",
    },
    rollActions: [
      {
        id: "tails_fly",
        name: "Fly",
        dice: [diceSpec(DiceColor.YELLOW, 4)], // shown as 4 yellow dice in preview
        maxRollIterations: 2, // preview shows “x2”
        resolve(ctx) {
          // Preview gist: keep matching dice, discard the rest; if no matches, keep 1 die.
          const pool = ctx.dicePool ?? [];
          if (pool.length === 0) return;

          const counts = new Map();
          for (const d of pool) counts.set(d.value, (counts.get(d.value) ?? 0) + 1);

          const hasPair = [...counts.values()].some(c => c >= 2);

          if (hasPair) {
            // discard all dice that are not part of any value with count >=2
            for (let i = pool.length - 1; i >= 0; i--) {
              const v = pool[i].value;
              if ((counts.get(v) ?? 0) < 2) ctx.discardDieFromPool?.(i);
            }
          } else {
            // keep exactly one die (highest by default), discard rest
            let keepIndex = 0;
            for (let i = 1; i < pool.length; i++) {
              if (pool[i].value > pool[keepIndex].value) keepIndex = i;
            }
            for (let i = pool.length - 1; i >= 0; i--) {
              if (i !== keepIndex) ctx.discardDieFromPool?.(i);
            }
          }
        },
        notes:
          "Fly (x2): keep matching results; if none, keep only 1 die. TODO confirm exact keep/discard wording.",
      },
      {
        id: "tails_spin_jump",
        name: "Spin Jump",
        dice: [diceSpec(DiceColor.RED, 3)], // shown as 3 red dice in preview
        maxRollIterations: 1,
        resolve(ctx) {
          // Preview text: “SPEND [red]: Gain [ring] if spent on a Badnik.”
          // This is a spend-time rule; we keep it here as metadata.
        },
        notes: "Spend red dice: gain a ring when spent on a Badnik (TODO confirm amount/limits).",
      },
      {
        id: "tails_propeller_reroll",
        name: "Propeller Reroll",
        dice: [],
        maxRollIterations: 1,
        resolve(ctx) {
          // TODO: Rightmost Tails action text is cut off in previews.
        },
        notes: "TODO: Confirm Tails’ Propeller Reroll dice + rule text.",
      },
    ],
  },

  [CharacterId.AMY]: {
    id: CharacterId.AMY,
    name: "Amy",
    ability: {
      id: "amy_piko_piko_hammer",
      name: "Piko Piko Hammer",
      timing: "SPEND",
      uses: "ONCE_PER_TURN",
      apply(ctx, payload) {
        // Preview text: “May raise the result of the spent die by 1 (6 will change to a 1)”
        const { dieIndex } = payload ?? {};
        const die = ctx.dicePool?.[dieIndex];
        if (!die) return;
        let v = die.value + 1;
        if (v > 6) v = 1;
        die.value = v;

        ctx.markAbilityUsedThisTurn?.(CharacterId.AMY);
      },
      notes:
        "Raise a spent die’s result by 1 (wrap 6→1).",
    },
    rollActions: [
      {
        id: "amy_hammer_throw",
        name: "Hammer Throw",
        dice: [diceSpec(DiceColor.RED, 3)], // shown as 3 red dice in preview
        maxRollIterations: 1,
        resolve(ctx) {
          // Preview text: “SPEND [red]: May spend on any player’s Badnik (Once per turn).”
          // This is spend-time; implement in your placement/spend resolver.
        },
        notes:
          "Spend red dice: may spend on any player’s Badnik (once per turn).",
      },
      {
        id: "amy_spin_dash",
        name: "Spin Dash",
        dice: [diceSpec(DiceColor.BLUE, 1), diceSpec(DiceColor.RED, 1)], // preview shows blue+red; exact count TODO
        maxRollIterations: 999,
        resolve(ctx) {
          // Preview text (same wording style as Sonic): repeat roll until 2 results match.
          ctx.ensureAtLeastOnePairInPool?.();
        },
        notes:
          "Repeat rolling until you have a matching pair in your dice pool (TODO confirm exact dice shown).",
      },
      {
        id: "amy_third_action",
        name: "Hammer (TODO full name)",
        dice: [],
        maxRollIterations: 1,
        resolve(ctx) {
          // TODO: Amy’s 3rd action exists in preview but text is partially cut off.
        },
        notes:
          "TODO: Confirm Amy’s third roll action name/dice/rules from physical dashboard/rulebook.",
      },
    ],
  },

  [CharacterId.KNUCKLES]: {
    id: CharacterId.KNUCKLES,
    name: "Knuckles",
    ability: {
      id: "knuckles_secret_passage",
      name: "Secret Passage",
      timing: "PASSIVE",
      uses: "UNLIMITED",
      apply(ctx, payload) {
        // Preview text gist:
        // “Secret Passage is an extra Route only you may play on.
        //  Place it near you at the start of a game.
        //  If completed: (reward shown in preview; TODO confirm exact reward).”
        ctx.enableSecretPassageRouteForPlayer?.(payload?.playerId);
      },
      notes:
        "Adds a personal extra route (Secret Passage). TODO confirm completion reward.",
    },
    rollActions: [
      {
        id: "knuckles_wall_climb",
        name: "Wall Climb",
        dice: [diceSpec(DiceColor.RED, 3)], // shown as 3 red dice in preview
        maxRollIterations: 3, // preview shows “x3”
        resolve(ctx) {
          // Preview text:
          // “Save a die as long as its result is higher than the last saved die.
          //  Discard all unsaved dice.”
          // Here we just store a helper rule; the roll-loop should enforce increasing saves.
          ctx.resolveWallClimbIncreasingSaves?.();
        },
        notes:
          "Up to 3 roll iterations; you may only keep a die if it’s higher than the last kept die; discard the rest (TODO confirm exact sequencing).",
      },
      {
        id: "knuckles_spin_attack",
        name: "Spin Attack",
        dice: [diceSpec(DiceColor.BLUE, 4)], // shown as 4 blue dice in preview
        maxRollIterations: 1,
        resolve(ctx) {
          // Preview text: “AVOID: May change all [blue] into [red].”
          // This is an avoid-time effect; record as metadata.
        },
        notes:
          "Avoid option: may change all blue dice into red (TODO confirm timing/limits).",
      },
      {
        id: "knuckles_third_action",
        name: "Dig (TODO name)",
        dice: [],
        maxRollIterations: 1,
        resolve(ctx) {
          // TODO: Knuckles’ rightmost action text is truncated in preview.
        },
        notes:
          "TODO: Confirm Knuckles’ third roll action name/dice/rules from physical dashboard/rulebook.",
      },
    ],
  },
};

export function getCharacterBoard(characterId) {
  const board = characterBoards[characterId];
  if (!board) throw new Error(`Unknown characterId: ${characterId}`);
  return board;
}
