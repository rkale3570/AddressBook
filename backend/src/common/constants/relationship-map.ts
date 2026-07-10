import { RelationshipType } from '../enum/relationship-type.enum';

export const RELATIONSHIP_MAP: Record<RelationshipType, RelationshipType> = {
  // Marriage
  [RelationshipType.HUSBAND]: RelationshipType.WIFE,
  [RelationshipType.WIFE]: RelationshipType.HUSBAND,
  [RelationshipType.SPOUSE]: RelationshipType.SPOUSE,

  // Parent / Child
  [RelationshipType.FATHER]: RelationshipType.CHILD,
  [RelationshipType.MOTHER]: RelationshipType.CHILD,
  [RelationshipType.PARENT]: RelationshipType.CHILD,

  [RelationshipType.SON]: RelationshipType.PARENT,
  [RelationshipType.DAUGHTER]: RelationshipType.PARENT,
  [RelationshipType.CHILD]: RelationshipType.PARENT,

  // Siblings
  [RelationshipType.BROTHER]: RelationshipType.SIBLING,
  [RelationshipType.SISTER]: RelationshipType.SIBLING,
  [RelationshipType.SIBLING]: RelationshipType.SIBLING,

  // Business
  [RelationshipType.BUSINESS_PARTNER]: RelationshipType.BUSINESS_PARTNER,
  [RelationshipType.TEAM_MEMBER]: RelationshipType.TEAM_MEMBER,

  // Others
  [RelationshipType.OTHER]: RelationshipType.OTHER,
};