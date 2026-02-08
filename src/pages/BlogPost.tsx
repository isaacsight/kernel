import { useParams, Navigate } from 'react-router-dom'
import { PostLayout } from '../components/blog/PostLayout'
import { getPostBySlug } from '../utils/markdown'

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) {
    return <Navigate to="/blog" replace />
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <PostLayout post={post} />
    </div>
  )
}
