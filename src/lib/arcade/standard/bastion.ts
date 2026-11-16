/**
 * The arcade scoring standard for `bastion` (Iron Wall, the tank-defence shooter, born on the standard at bastionRev 2;
 * bastionRev 3 adds the drones; bastionRev 4 the levels; docs/arcade-standard/bastion.md): the dealt spec (rev 4's at
 * Normal) and the parts, re-exported from the sim. `parts` scores each state on its own revision's (and level's) spec and
 * returns null for the original (unstamped) Bastion's state.
 */
import { BASTION_STD_SPEC_V4 } from "../bastionTank";

export const spec = BASTION_STD_SPEC_V4.normal;
export { bastionStdParts as parts } from "../bastionTank";
