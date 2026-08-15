virtualize posts
tabs for join requests and pending posts
more post formats
number of members in a group (500, 23K)
cursor-based pagination for posts
edit posts
likes on posts
hash cursor id
upload image to storage ahead of time.
reduce images size on the backend

fixes:
* use supabase ssr package
<!-- * revokeObjectURL -->
* protect Routes


if i reply while the replies are shown, i don't see my reply added until I refresh the page

non-member shouldn't be able to see access /groups/:id/post/:postId

cancel join request button doesn't exist