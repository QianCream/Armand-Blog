<template>
  <section class="comments-section panel reveal collapse-reveal">
    <div class="panel-head">
      <span class="panel-label">comments</span>
      <span class="panel-index">{{ comments.length }}</span>
    </div>
    <div class="comments-toolbar">
      <label class="comments-sort">
        <span>排序</span>
        <select v-model="sortMode">
          <option value="latest">最新</option>
          <option value="oldest">最早</option>
          <option value="top">仅看主评论</option>
        </select>
      </label>
    </div>
    <p class="comments-status">{{ status }}</p>
    <div class="comments-list">
      <template v-for="comment in topLevelComments" :key="comment.id">
        <article class="comment-item comment-item-top" :class="{ 'is-replying': replyingToId === comment.id }">
          <div class="comment-meta">
            <div class="comment-author">
              <strong>{{ comment.author || "匿名" }}</strong>
            </div>
            <time>{{ formatCommentDate(comment.createdAt) }}</time>
          </div>
          <p>{{ comment.content || "" }}</p>
          <div class="comment-actions">
            <button type="button" class="comment-reply-btn" @click="openReply(comment)">回复</button>
            <button
              type="button"
              class="comment-like-btn"
              :class="{ 'is-liked': Boolean(comment.liked) }"
              :aria-pressed="String(Boolean(comment.liked))"
              :disabled="Boolean(pendingLikes[comment.id])"
              @click="toggleLike(comment)"
            >
              赞 <span>{{ Number(comment.likeCount || 0) }}</span>
            </button>
          </div>
        </article>
        <form v-if="replyingToId === comment.id" class="comment-inline-reply" @submit.prevent="submitReply(comment.id)">
          <div class="comment-inline-reply-head">回复 @{{ comment.author || "匿名" }}</div>
          <div class="comment-inline-reply-fields">
            <input
              v-model="replyForms[comment.id].author"
              type="text"
              maxlength="40"
              placeholder="你的昵称"
              required
              @input="persistReplyDraft(comment.id)"
            >
            <input
              :data-reply-content-id="comment.id"
              v-model="replyForms[comment.id].content"
              type="text"
              maxlength="1000"
              placeholder="写下你的回复..."
              required
              @input="persistReplyDraft(comment.id)"
            >
          </div>
          <div class="comment-inline-reply-actions">
            <button type="submit" class="comment-inline-reply-submit" :disabled="Boolean(submittingReplies[comment.id])">
              {{ submittingReplies[comment.id] ? "发送中..." : "发送" }}
            </button>
            <button type="button" class="comment-inline-reply-cancel" @click="closeReply">取消</button>
          </div>
        </form>
        <div v-if="sortMode !== 'top' && (repliesByParentId[comment.id] || []).length" class="comment-replies">
          <article v-for="reply in repliesByParentId[comment.id]" :key="reply.id" class="comment-item comment-item-reply">
            <div class="comment-meta">
              <div class="comment-author">
                <strong>{{ reply.author || "匿名" }}</strong>
              </div>
              <time>{{ formatCommentDate(reply.createdAt) }}</time>
            </div>
            <p>{{ reply.content || "" }}</p>
            <div class="comment-actions">
              <button
                type="button"
                class="comment-like-btn"
                :class="{ 'is-liked': Boolean(reply.liked) }"
                :aria-pressed="String(Boolean(reply.liked))"
                :disabled="Boolean(pendingLikes[reply.id])"
                @click="toggleLike(reply)"
              >
                赞 <span>{{ Number(reply.likeCount || 0) }}</span>
              </button>
            </div>
          </article>
        </div>
      </template>
    </div>
    <form class="comments-form" @submit.prevent="submitTopComment">
      <label class="comments-field">
        <span>昵称</span>
        <input
          v-model="form.author"
          type="text"
          maxlength="40"
          required
          placeholder="你的名字"
          @input="persistTopDraft"
        >
      </label>
      <label class="comments-field">
        <span>评论</span>
        <textarea
          v-model="form.content"
          rows="4"
          maxlength="1000"
          required
          placeholder="写点什么..."
          @input="persistTopDraft"
        ></textarea>
      </label>
      <button class="button button-primary comments-submit" type="submit" :disabled="submittingTop">
        {{ submittingTop ? "提交中..." : "发布评论" }}
      </button>
    </form>
  </section>
</template>

<script>
export default {
  props: {
    articleSlug: {
      type: String,
      required: true,
    },
  },
  data() {
    const { allowedCommentSortModes, readDraftFromStorage } = this.$siteUtils.comments;
    const sortStorageKey = `comments-sort:${this.articleSlug}`;
    const storedSortMode = localStorage.getItem(sortStorageKey) || "latest";
    const topDraft = readDraftFromStorage(`comments-draft:${this.articleSlug}`);

    return {
      comments: [],
      status: "加载评论中...",
      sortMode: allowedCommentSortModes.has(storedSortMode) ? storedSortMode : "latest",
      form: {
        author: topDraft.author,
        content: topDraft.content,
      },
      replyingToId: null,
      replyForms: {},
      submittingTop: false,
      submittingReplies: {},
      pendingLikes: {},
    };
  },
  computed: {
    sortStorageKey() {
      return `comments-sort:${this.articleSlug}`;
    },
    mainDraftStorageKey() {
      return `comments-draft:${this.articleSlug}`;
    },
    sortedComments() {
      const sorted = [...this.comments];

      sorted.sort((left, right) => {
        const leftTs = this.$siteUtils.comments.getCommentTimestamp(left);
        const rightTs = this.$siteUtils.comments.getCommentTimestamp(right);

        if (this.sortMode === "oldest") {
          return leftTs - rightTs;
        }

        return rightTs - leftTs;
      });

      if (this.sortMode === "top") {
        return sorted.filter((comment) => !comment.parentId);
      }

      return sorted;
    },
    topLevelComments() {
      return this.sortedComments.filter((comment) => !comment.parentId);
    },
    repliesByParentId() {
      if (this.sortMode === "top") {
        return {};
      }

      return this.sortedComments
        .filter((comment) => comment.parentId)
        .reduce((groups, reply) => {
          const parentId = reply.parentId;

          if (!groups[parentId]) {
            groups[parentId] = [];
          }

          groups[parentId].push(reply);
          return groups;
        }, {});
    },
  },
  watch: {
    sortMode(nextMode) {
      localStorage.setItem(this.sortStorageKey, nextMode);
      this.updateStatus();
    },
  },
  mounted() {
    this.$siteUtils.siteEffects.refreshDynamicNodes(this.$el);
    void this.fetchComments();
  },
  updated() {
    this.$siteUtils.siteEffects.refreshDynamicNodes(this.$el);
  },
  methods: {
    formatCommentDate(value) {
      return this.$siteUtils.comments.formatCommentDate(value);
    },
    replyDraftKey(commentId) {
      return `comments-reply-draft:${this.articleSlug}:${commentId}`;
    },
    persistTopDraft() {
      this.$siteUtils.comments.writeDraftToStorage(this.mainDraftStorageKey, this.form);
    },
    ensureReplyForm(commentId) {
      if (!this.replyForms[commentId]) {
        const draft = this.$siteUtils.comments.readDraftFromStorage(this.replyDraftKey(commentId));

        this.replyForms[commentId] = {
          author: draft.author || this.form.author.trim(),
          content: draft.content || "",
        };
      }

      return this.replyForms[commentId];
    },
    persistReplyDraft(commentId) {
      this.$siteUtils.comments.writeDraftToStorage(this.replyDraftKey(commentId), this.replyForms[commentId]);
    },
    openReply(comment) {
      if (this.replyingToId === comment.id) {
        this.closeReply();
        return;
      }

      this.ensureReplyForm(comment.id);
      this.replyingToId = comment.id;

      this.$nextTick(() => {
        const field = this.$el.querySelector(`[data-reply-content-id="${comment.id}"]`);
        field?.focus();
      });
    },
    closeReply() {
      this.replyingToId = null;
    },
    async requestJson(path, options = {}) {
      const response = await fetch(this.$siteUtils.comments.buildCommentsApiUrl(path), {
        credentials: "include",
        ...options,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const retryTip = payload.retryAfter ? ` 请 ${payload.retryAfter} 秒后再试。` : "";
        throw new Error((payload.error || `Request failed: ${response.status}`) + retryTip);
      }

      return payload;
    },
    async submitComment({ author, content, parentId = null }) {
      const normalizedAuthor = String(author || "").trim();
      const normalizedContent = String(content || "").trim();

      if (!normalizedAuthor || !normalizedContent) {
        throw new Error("昵称和评论内容不能为空。");
      }

      const payload = await this.requestJson("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleSlug: this.articleSlug,
          author: normalizedAuthor,
          content: normalizedContent,
          parentId,
        }),
      });

      return payload.comment;
    },
    updateStatus() {
      if (!this.comments.length) {
        this.status = "还没有评论，来做第一个留言的人吧。";
        return;
      }

      if (this.sortMode === "top") {
        this.status = `显示 ${this.topLevelComments.length} 条主评论（共 ${this.comments.length} 条）`;
        return;
      }

      this.status = `共 ${this.comments.length} 条评论（含回复）`;
    },
    async fetchComments() {
      this.status = "加载评论中...";

      try {
        const payload = await this.requestJson(`/api/comments?article=${encodeURIComponent(this.articleSlug)}`);
        this.comments = Array.isArray(payload.comments) ? payload.comments : [];

        if (!this.comments.some((comment) => comment.id === this.replyingToId)) {
          this.replyingToId = null;
        }

        this.updateStatus();
      } catch (error) {
        this.status = "评论加载失败，请稍后刷新重试。";
        console.error(error);
      }
    },
    async submitTopComment() {
      this.submittingTop = true;

      try {
        await this.submitComment({
          author: this.form.author,
          content: this.form.content,
          parentId: null,
        });
        this.form.author = this.form.author.trim();
        this.form.content = "";
        this.persistTopDraft();
        this.status = "评论发布成功。";
        await this.fetchComments();
      } catch (error) {
        this.status = `评论发布失败：${error.message || "未知错误"}`;
        console.error(error);
      } finally {
        this.submittingTop = false;
      }
    },
    async submitReply(commentId) {
      const replyForm = this.replyForms[commentId];

      if (!replyForm) {
        return;
      }

      this.submittingReplies[commentId] = true;

      try {
        await this.submitComment({
          author: replyForm.author,
          content: replyForm.content,
          parentId: commentId,
        });
        this.form.author = String(replyForm.author || "").trim();
        this.persistTopDraft();
        localStorage.removeItem(this.replyDraftKey(commentId));
        delete this.replyForms[commentId];
        this.replyingToId = null;
        this.status = "回复发布成功。";
        await this.fetchComments();
      } catch (error) {
        this.status = `回复发布失败：${error.message || "未知错误"}`;
        console.error(error);
      } finally {
        delete this.submittingReplies[commentId];
      }
    },
    async toggleLike(comment) {
      if (this.pendingLikes[comment.id]) {
        return;
      }

      const shouldLike = !comment.liked;
      this.pendingLikes[comment.id] = true;

      try {
        const payload = await this.requestJson(`/api/comments/${encodeURIComponent(String(comment.id))}/like`, {
          method: shouldLike ? "POST" : "DELETE",
        });

        comment.liked = Boolean(payload.liked);
        comment.likeCount = Number(payload.likeCount || 0);
      } catch (error) {
        this.status = `点赞失败：${error.message || "未知错误"}`;
        console.error(error);
      } finally {
        delete this.pendingLikes[comment.id];
      }
    },
  },
};
</script>
