/**
 * Repository Layer Index
 * Exports all data access modules
 */

module.exports = {
  memberRepository: require('./MemberRepository'),
  interactionRepository: require('./InteractionRepository'),
  relationshipRepository: require('./RelationshipRepository'),
};
