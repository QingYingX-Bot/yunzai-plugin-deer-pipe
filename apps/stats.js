// 统计功能

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey } from '../utils/redis.js';

export class StatsApp extends plugin {
    constructor() {
        super({
            name: "🦌管统计",
            dsc: "群统计和全局统计",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^#鹿鹿统计$",
                    fnc: "groupStats",
                },
                {
                    reg: "^#(?:鹿鹿总|总鹿鹿)统计$",
                    fnc: "totalStats",
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

    getUserMonthlyStats(userData, currentMonth) {
        if (!userData || userData.lastSignMonth !== currentMonth) {
            return null;
        }

        let count = 0;
        let days = 0;
        for (const day in userData) {
            if (day !== 'lastSignMonth' && day !== 'monthHistory' && !day.startsWith('w_') && userData[day] > 0) {
                count += userData[day];
                days++;
            }
        }

        return count > 0 ? { count, days } : null;
    }

    async getCurrentGroupMemberMap(e) {
        if (!e.group_id) return null;
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        return await curGroup?.getMemberMap();
    }

    maskUserId(userId) {
        const text = String(userId);
        if (text.length <= 6) {
            return `QQ-${text}`;
        }
        return `QQ-${text.slice(0, 3)}***${text.slice(-3)}`;
    }

    getDisplayName(userId, membersMap) {
        const member = membersMap?.get(Number(userId));
        return this.filterMessageContent(member?.card || member?.nickname || this.maskUserId(userId));
    }

    /**
     * 群统计
     * @param {object} e 事件对象
     */
    async groupStats(e) {
        if (!e.group_id) {
            await e.reply("此功能只能在群聊中使用~");
            return;
        }

        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        const membersMap = await curGroup?.getMemberMap();
        
        if (!membersMap) {
            await e.reply("获取群成员信息失败~");
            return;
        }

        let groupTotalCount = 0;
        let groupActiveUsers = 0;
        let groupActiveDays = 0;
        const userStats = [];

        for (const [userId, member] of membersMap) {
            const stats = this.getUserMonthlyStats(signData[userId], currentMonth);
            if (stats) {
                groupTotalCount += stats.count;
                groupActiveUsers++;
                groupActiveDays += stats.days;
                userStats.push({
                    name: this.filterMessageContent(member.card || member.nickname),
                    count: stats.count,
                    days: stats.days
                });
            }
        }

        userStats.sort((a, b) => b.count - a.count);

        let statsText = `📊 群聊鹿鹿统计\n📅 统计月份：${currentMonth}月\n🦌 群总次数：${groupTotalCount}次\n👥 活跃用户：${groupActiveUsers}人\n📆 总活跃天数：${groupActiveDays}天`;
        
        if (userStats.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
            statsText += `\n\n🏆 排行榜：\n`;
            userStats.slice(0, 5).forEach((user, index) => {
                statsText += `${medals[index]} ${user.name}: ${user.count}次 (${user.days}天)\n`;
            });
        }

        await e.reply(statsText);
    }

    /**
     * 全局统计
     * @param {object} e 事件对象
     */
    async totalStats(e) {
        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const membersMap = await this.getCurrentGroupMemberMap(e);
        
        let globalTotalCount = 0;
        let globalActiveUsers = 0;
        let globalActiveDays = 0;
        const userStats = [];

        for (const userId in signData) {
            const stats = this.getUserMonthlyStats(signData[userId], currentMonth);
            if (stats) {
                globalTotalCount += stats.count;
                globalActiveUsers++;
                globalActiveDays += stats.days;
                userStats.push({
                    name: this.getDisplayName(userId, membersMap),
                    count: stats.count,
                    days: stats.days
                });
            }
        }

        userStats.sort((a, b) => b.count - a.count);

        let statsText = `📊 全局鹿鹿统计 - ${currentMonth}月\n🦌 全局总次数：${globalTotalCount}次\n👥 活跃用户：${globalActiveUsers}人\n📆 总活跃天数：${globalActiveDays}天`;

        if (userStats.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
            statsText += `\n\n🏆 排行榜：\n`;
            userStats.slice(0, 5).forEach((user, index) => {
                statsText += `${medals[index]} ${user.name}: ${user.count}次 (${user.days}天)\n`;
            });
        }

        await e.reply(statsText);
    }
}
