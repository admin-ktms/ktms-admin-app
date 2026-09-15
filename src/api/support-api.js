import { adminApi } from "./admin-api.js";

export async function getSupportCases(filters = {}) {
  return adminApi("support.list", {
    filter: filters.filter || null,
    caseType: filters.caseType || null,
    caseCategory: filters.caseCategory || null,
    search: filters.search || null
  });
}

export async function getSupportCase(caseId) {
  return adminApi("support.get", {
    caseId
  });
}

export async function respondToSupportCase(caseId, message) {
  return adminApi("support.respond", {
    caseId,
    message
  });
}

export async function requestSupportInformation(caseId, message) {
  return adminApi("support.requestInformation", {
    caseId,
    message
  });
}

export async function resolveSupportCase(
  caseId,
  resolution,
  resolutionExplanation
) {
  return adminApi("support.resolve", {
    caseId,
    resolution,
    resolutionExplanation
  });
}

export async function rejectSupportCase(
  caseId,
  resolution,
  resolutionExplanation
) {
  return adminApi("support.reject", {
    caseId,
    resolution,
    resolutionExplanation
  });
}

export async function closeSupportCase(caseId) {
  return adminApi("support.close", {
    caseId
  });
}

export async function reopenSupportCase(caseId, message) {
  return adminApi("support.reopen", {
    caseId,
    message
  });
}
