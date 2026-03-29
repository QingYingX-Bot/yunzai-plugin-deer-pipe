// 管理员功能（数据清理等）

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey, redisSetKey, redisDeleteKey } from '../utils/redis.js';

export class AdminApp extends plugin {
    constructor() {
        super({
            name: "🦌管管理",
            dsc: "管理员功能",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^#(?:强制)?清空鹿数据$",
                    fnc: "confirmClearDeerData",
                },
                {
                    reg: "^#确认清空鹿数据$",
                    fnc: "clearDeerData",
                },
                {
                    reg: "^#清理鹿鹿记录",
                    fnc: "clearUserDeerData",
                    permission: "admin"
                }
            ]
        })
    }

    /**
     * 过滤消息内容
     * @param {string} text 文本
     * @returns {string} 过滤后的文本
     */
    filterMessageContent(text) {
        if (!text) return '';
        return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_()（）【】\[\]{}，。！？、：；""''…~@#$%^&*+=|\\/<>]/g, '');
    }

    /**
     * 确认清空数据
     * @param {object} e 事件对象
     */
    async confirmClearDeerData(e) {
        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const isForce = /强制/.test(e.msg);
        let usersCount = 0, deerTotal = 0, withdrawalTotal = 0, activeDaysTotal = 0;

        for (const userId in deerData) {
            const userData = deerData[userId];
            if (!userData) continue;
            usersCount++;
            let userActiveDays = 0;
            for (const key in userData) {
                if (key === 'lastSignMonth') continue;
                if (!isNaN(key)) {
                    const c = Number(userData[key] || 0);
                    if (c > 0) { deerTotal += c; userActiveDays++; }
                } else if (key.startsWith('w_')) {
                    withdrawalTotal += Number(userData[key] || 0);
                }
            }
            activeDaysTotal += userActiveDays;
        }

        const summary = `${isForce ? '已清空' : '即将清空'}全部鹿数据（签到）\n👥 参与用户：${usersCount} 人\n🦌 鹿总次数：${deerTotal} 次\n❌ 戒鹿总次数：${withdrawalTotal} 次\n📆 累计活跃天数：${activeDaysTotal} 天`;
        
        if (isForce) {
            await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE);
            await e.reply(summary);
        } else {
            await e.reply(`${summary}\n\n若确认，请发送：#确认清空鹿数据`);
        }
    }

    /**
     * 清空数据
     * @param {object} e 事件对象
     */
    async clearDeerData(e) {
        await redisDeleteKey(REDIS_YUNZAI_DEER_PIPE);
        await e.reply("已清空全部鹿数据（签到）");
    }

    /**
     * 清理指定用户数据
     * @param {object} e 事件对象
     */
    async clearUserDeerData(e) {
        let targetUserId = null;
        let targetUser = null;
        let displayName = "";

        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            targetUser = membersMap.get(parseInt(e.at));
            if (targetUser) {
                targetUserId = parseInt(e.at);
                displayName = this.filterMessageContent(targetUser.card || targetUser.nickname);
            }
        } else {
            const msg = e.msg || e.raw_message || "";
            const qqMatch = msg.match(/\d{5,}/);
            if (qqMatch) {
                targetUserId = parseInt(qqMatch[0]);
                if (e.isGroup) {
                    const curGroup = e.group || Bot?.pickGroup(e.group_id);
                    const membersMap = await curGroup?.getMemberMap();
                    targetUser = membersMap.get(targetUserId);
                    if (targetUser) {
                        displayName = this.filterMessageContent(targetUser.card || targetUser.nickname);
                    } else {
                        displayName = `QQ:${targetUserId}`;
                    }
                } else {
                    displayName = `QQ:${targetUserId}`;
                }
            }
        }

        if (!targetUserId) {
            await e.reply("请 @用户 或提供QQ号\n格式：#清理鹿鹿记录 @用户 或 #清理鹿鹿记录 123456789");
            return;
        }

        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        
        let deerTotal = 0;
        let withdrawalTotal = 0;
        let activeDays = 0;
        const userDeerData = deerData[targetUserId];
        
        if (userDeerData) {
            for (const key in userDeerData) {
                if (key === 'lastSignMonth') continue;
                if (!isNaN(key)) {
                    const count = Number(userDeerData[key] || 0);
                    if (count > 0) {
                        deerTotal += count;
                        activeDays++;
                    }
                } else if (key.startsWith('w_')) {
                    withdrawalTotal += Number(userDeerData[key] || 0);
                }
            }
        }

        if (deerData[targetUserId]) {
            delete deerData[targetUserId];
            await redisSetKey(REDIS_YUNZAI_DEER_PIPE, deerData);
        }

        let report = `✅ 已清理 ${displayName} 的鹿鹿记录\n`;
        report += `==================\n`;
        report += `🦌 鹿总次数：${deerTotal} 次\n`;
        report += `❌ 戒鹿总次数：${withdrawalTotal} 次\n`;
        report += `📆 活跃天数：${activeDays} 天`;

        await e.reply(report);
    }
}