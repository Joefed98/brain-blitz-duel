/**
 * The arcade scoring standard for `bastion` (Iron Wall, the tank-defence shooter, born on the standard at bastionRev 2;
 * bastionRev 3 adds the drones; bastionRev 4 the levels; bastionRev 5 the ladder; docs/arcade-standard/bastion.md): the
 * dealt spec (rev 5's at Normal) and the parts, re-exported from the sim. `parts` scores each state on its own revision's
 * (and level's) spec and returns null for the original (unstamped) Bastion's state.
 */
import { BASTION_STD_SPEC_V5 } from "../bastionTank";

export const spec = BASTION_STD_SPEC_V5.normal;
export { bastionStdParts as parts } from "../bastionTank";
