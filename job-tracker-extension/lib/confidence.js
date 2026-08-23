const JobTrackerConfidence = {
  THRESHOLD: 68,

  score(record, pageContext) {
    return JobTrackerFusionScorer.score(record, pageContext).confidence;
  },

  fusion(record, pageContext) {
    return JobTrackerFusionScorer.score(record, pageContext);
  },

  shouldConfirm(score, source, pageContext) {
    if (source === 'popup' || source === 'manual-panel' || source === 'confirmed') return false;

    const auto = pageContext?.ruleExtraction?.auto;
    const info = pageContext?.ruleExtraction || {};
    if (auto?.status === '已投递' && score >= 64 && info.company && info.position) {
      return false;
    }

    return score < this.THRESHOLD;
  }
};
