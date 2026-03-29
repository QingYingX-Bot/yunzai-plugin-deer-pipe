import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import { REDIS_YUNZAI_DEER_PIPE } from "../constants/core.js";
import { redisExistAndGetKey } from "../utils/redis.js";
import Base from "../model/base.js";

export class LeaderboardApp extends plugin {
    constructor() {
        super({
            name: "🦌管排行榜",
            dsc: "一个🦌管排行榜",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^(🦌|鹿|戒🦌|戒鹿)榜$",
                    fnc: "leaderboard",
                }
            ]
        })
    }

    getRankData(deerData, members, order = "desc") {
        const curMonth = new Date().getMonth() + 1;
        const rankData = Object.keys(deerData)
            .filter(deer => members.includes(parseInt(deer)) && deerData[deer].lastSignMonth === curMonth)
            .map(deer => ({
                id: deer,
                sum: Object.keys(deerData[deer])
                    .filter(subKey => !isNaN(subKey))
                    .reduce((acc, subKey) => acc + deerData[deer][subKey], 0)
            }));
        rankData.sort((a, b) => order === "asc" ? a.sum - b.sum : b.sum - a.sum);
        return rankData;
    }

    async leaderboard(e) {
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        const membersMap = await curGroup?.getMemberMap();
        const [members, deerData] = await Promise.all([
            membersMap,
            redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE)
        ]);

        if (!deerData) return;

        const membersList = Array.from(members.keys());
        const isWithdrawal = e.msg.includes("戒");
        const rankData = this.getRankData(deerData, membersList, isWithdrawal ? "asc" : "desc");

        const rankDataWithMembers = await Promise.all(rankData.map(async (item, index) => {
            const groupInfo = membersMap.get(parseInt(item.id));
            return {
                ...item,
                card: groupInfo.card || groupInfo.nickname,
                order: index + 1
            };
        }));

        const base = new Base(e);
        base.model = 'leaderboard';
        const img = await puppeteer.screenshot("leaderboard", {
            ...base.screenData,
            saveId: 'leaderboard',
            rankData: rankDataWithMembers,
            deerTitle: isWithdrawal ? "戒鹿" : "鹿管",
            curMonth: new Date().getMonth() + 1
        });
        e.reply(img);
    }
}
