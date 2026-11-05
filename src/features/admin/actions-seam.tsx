"use client";

import { createContext, useContext } from "react";
import { reorder } from "@/shared/actions/admin/reorder";
import { resetContent, saveContent } from "@/shared/actions/admin/content";
import { saveSettings } from "@/shared/actions/admin/settings";
import { deleteSubmission, setSubmissionRead } from "@/shared/actions/admin/submissions";
import { changePassword } from "@/shared/actions/admin/auth";
import { deleteProject, setProjectPublished } from "@/shared/actions/admin/projects";
import { deleteCategory, setCategoryVisible } from "@/shared/actions/admin/categories";

/**
 * The server actions the admin shell itself calls (everything except the per-record editors).
 * Components read them from context so a test harness can swap in mocks; the default is the real
 * set. Every real action still authorizes on the server, so this seam never weakens anything.
 */
export interface AdminActions {
  reorder: typeof reorder;
  saveContent: typeof saveContent;
  resetContent: typeof resetContent;
  saveSettings: typeof saveSettings;
  setSubmissionRead: typeof setSubmissionRead;
  deleteSubmission: typeof deleteSubmission;
  changePassword: typeof changePassword;
  setProjectPublished: typeof setProjectPublished;
  deleteProject: typeof deleteProject;
  setCategoryVisible: typeof setCategoryVisible;
  deleteCategory: typeof deleteCategory;
}

export const realAdminActions: AdminActions = {
  reorder,
  saveContent,
  resetContent,
  saveSettings,
  setSubmissionRead,
  deleteSubmission,
  changePassword,
  setProjectPublished,
  deleteProject,
  setCategoryVisible,
  deleteCategory,
};

export const AdminActionsContext = createContext<AdminActions>(realAdminActions);
export const AdminActionsProvider = AdminActionsContext.Provider;
export const useAdminActions = () => useContext(AdminActionsContext);
