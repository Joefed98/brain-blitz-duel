/**
 * The arcade scoring standard for `bastion` (Iron Wall, the tank-defence shooter, born on the standard at bastionRev 2;
 * bastionRev 3 adds the drones; docs/arcade-standard/bastion.md): the dealt spec (rev 3's) and the parts, re-exported
 * from the sim. `parts` scores a rev-2 state on rev 2's spec and returns null for the original (unstamped) Bastion's state.
 */
export { BASTION_STD_SPEC_V3 as spec, bastionStdParts as parts } from "../bastionTank";
