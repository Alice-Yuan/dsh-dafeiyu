// Recognize explicit natural-language viewing requests without spending a model call.
// UID metadata is authoritative; uncertain/negated text never grants media access.
export function isOwnerVideoRequest(comment, ownerUid, botUid, baselineAt) {
    if (ownerUid === botUid || comment.uid !== ownerUid || !comment.mentionedUids?.includes(botUid) ||
        comment.createdAt <= baselineAt || comment.createdAt > Date.now() + 60_000)
        return false;
    const text = comment.text.replace(/@\S+/g, '').trim();
    if (/https?:\/\//i.test(text) || /BV[1-9A-HJ-NP-Za-km-z]{10}/.test(text) ||
        /(?:不要|不用|无需|别|不必|先不|暂时不|不需要|停止|取消)[^，。！？\n]{0,8}(?:看|检看|抽帧|分析)/.test(text) ||
        /(?:举例|例如|引用|转述|有人说|他说|她说|假如|如果)|[“”「」『』]/.test(text))
        return false;
    return /视频|画面|片段|镜头|动作|里面|里边/.test(text) &&
        /(?:帮我|请|麻烦|能不能|能否|想让你|需要你)[^，。！？\n]{0,20}(?:看|检看|分析|检查)|(?:看看|看下|看一下|看一看|检看|实际看|真正看|分析一下)/.test(text);
}
//# sourceMappingURL=owner-request.js.map