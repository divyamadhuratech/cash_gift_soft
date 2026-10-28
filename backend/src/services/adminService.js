import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import CeremonyFunction from "../models/Function.js";
import GiftEntry from "../models/Entry.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const [users, workspaces, functions, entries] = await Promise.all([
      User.find().select("-password").sort({ createdAt: -1 }).lean(),
      Workspace.find().sort({ createdAt: -1 }).lean(),
      CeremonyFunction.find().sort({ createdAt: -1 }).lean(),
      GiftEntry.find().sort({ createdAt: -1 }).lean(),
    ]);

    const totalUsers = users.length;
    const totalWorkspaces = workspaces.length;
    const totalFunctions = functions.length;
    const totalEntries = entries.length;
    const totalCollection = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

    const modeTotals = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    for (const e of entries) {
      modeTotals[e.mode] = (modeTotals[e.mode] || 0) + (e.amount || 0);
    }

    // Users per workspace
    const usersByWorkspace = {};
    for (const u of users) {
      const key = u.workspace ? String(u.workspace) : "none";
      usersByWorkspace[key] = (usersByWorkspace[key] || 0) + 1;
    }

    // Recent users (last 5)
    const recentUsers = users.slice(0, 5).map((u) => ({
      id: u._id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));

    // Recent entries (last 5)
    const recentEntries = entries.slice(0, 5).map((e) => ({
      id: e._id,
      name: e.name,
      amount: e.amount,
      mode: e.mode,
      receipt: e.receipt,
      createdAt: e.createdAt,
    }));

    return res.status(200).json({
      message: "Admin dashboard",
      summary: {
        totalUsers,
        totalWorkspaces,
        totalFunctions,
        totalEntries,
        totalCollection,
        paymentMix: modeTotals,
        usersByWorkspace,
      },
      recentUsers,
      recentEntries,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({ message: "Failed to load admin dashboard", error: error.message });
  }
};

export default { getAdminDashboard };