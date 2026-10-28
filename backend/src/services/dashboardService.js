import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import CeremonyFunction from "../models/Function.js";
import GiftEntry from "../models/Entry.js";

export const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [userCount, workspaceCount, functionCount, entryCount] = await Promise.all([
      User.countDocuments({ workspace: req.user.workspace }),
      Workspace.countDocuments({ owner: userId }),
      CeremonyFunction.countDocuments({ owner: userId }),
      GiftEntry.countDocuments({ owner: userId }),
    ]);

    // Aggregations by payment mode for the payment mix
    const totals = await GiftEntry.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: "$mode", total: { $sum: "$amount" } } },
    ]);

    const modeTotals = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    let grandTotal = 0;
    for (const t of totals) {
      modeTotals[t._id] = (modeTotals[t._id] || 0) + t.total;
      grandTotal += t.total;
    }

    return res.status(200).json({
      message: "Dashboard data",
      summary: {
        totalUsers: userCount,
        totalWorkspaces: workspaceCount,
        totalFunctions: functionCount,
        totalEntries: entryCount,
        totalCollection: grandTotal,
        paymentMix: modeTotals,
      },
      user: {
        id: req.user._id,
        email: req.user.email,
        displayName: req.user.displayName,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard", error: error.message });
  }
};

export default { getDashboard };