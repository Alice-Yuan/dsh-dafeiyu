import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnerVideoRequest } from '../dist/pilot/owner-request.js';
import { commentOf } from '../dist/platform/bilibili.js';

test('natural owner viewing request requires UID, structured mention and fresh explicit intent', () => {
  const command = { id: '90071992547409931234', uid: '10001', root: '0', parent: '0', text: '@bot 帮我看看这个视频里发生了什么', createdAt: 1000, mentionedUids: ['30001'] };
  assert.equal(isOwnerVideoRequest(command, '10001', '30001', 999), true);
  for (const change of [{ uid: '20001' }, { mentionedUids: [] }, { mentionedUids: ['30002'] }, { createdAt: 999 },
    { text: '@bot 你好' }, { text: '@bot 不要看这个视频' }, { text: '@bot 这个视频好看吗' }, { text: '他说 @bot 看看视频' }, { text: '@bot 看看 https://other.test/video' }]) {
    assert.equal(isOwnerVideoRequest({ ...command, ...change }, '10001', '30001', 999), false);
  }
  for (const text of ['@bot 看一下画面，别只读字幕', '@bot 请实际检看视频内容', '@bot 麻烦分析一下这个片段', '@bot 能不能看看里面的动作']) {
    assert.equal(isOwnerVideoRequest({ ...command, text }, '10001', '30001', 999), true);
  }
  assert.equal(isOwnerVideoRequest(command, '10001', '10001', 999), false);
  const row = { oid: '20001', type: 1, rpid: command.id, root: '0', parent: '0', member: { mid: '10001' }, content: { message: command.text, members: [{ mid: '30001' }] }, ctime: 1 };
  assert.deepEqual(commentOf(row, '20001').mentionedUids, ['30001']);
});
