"""Learning path API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.article import LearningPath, Article
from app.schemas.article import (
    LearningPathCreate, LearningPathResponse, 
    LearningPathDetailResponse
)
from app.services.ai_service import llm_service

router = APIRouter(prefix="/api/paths", tags=["learning_paths"])


@router.get("", response_model=List[LearningPathResponse])
async def list_paths(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    username_query: str | None = Query(None, alias="username", description="Superadmin: filter by username"),
):
    """List all learning paths for the current user."""
    target_user_id = current_user.id
    if current_user.is_super_admin and username_query:
        user_result = await db.execute(select(User).where(User.username == username_query))
        target_user = user_result.scalar_one_or_none()
        target_user_id = target_user.id if target_user else current_user.id
    query = select(LearningPath).where(
        LearningPath.user_id == target_user_id
    ).order_by(LearningPath.updated_at.desc())
    if status:
        query = query.where(LearningPath.status == status)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/generate", response_model=LearningPathResponse, status_code=201)
async def generate_path(
    data: LearningPathCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a learning path for a topic using AI."""
    # Get articles that match the topic (scoped to current user)
    result = await db.execute(
        select(Article).where(
            Article.user_id == current_user.id,
            Article.summary.isnot(None),
            (Article.plain_text.ilike(f"%{data.topic}%")) |
            (Article.title.ilike(f"%{data.topic}%"))
        ).order_by(Article.created_at.desc()).limit(50)
    )
    articles = result.scalars().all()
    
    if len(articles) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough articles for this topic. Add more articles first."
        )
    
    # Build article list
    articles_data = [
        {"id": str(a.id), "title": a.title, "summary": a.summary or ""}
        for a in articles
    ]
    
    # Generate via AI
    ai_result = await llm_service.generate_learning_path(data.topic, articles_data)
    
    # Create learning path
    path = LearningPath(
        title=ai_result.get('title', data.topic),
        description=ai_result.get('description', data.description or ''),
        topic=data.topic,
        articles_order=ai_result.get('ordered_articles', [str(a.id) for a in articles]),
        status='active',
        progress=0.0,
        user_id=current_user.id,
    )
    
    db.add(path)
    await db.commit()
    await db.refresh(path)
    
    return path


@router.get("/{path_id}", response_model=LearningPathDetailResponse)
async def get_path(
    path_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get learning path detail with article data."""
    result = await db.execute(
        select(LearningPath).where(
            LearningPath.id == path_id,
            LearningPath.user_id == current_user.id,
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    
    # Get articles in order (scoped to current user)
    articles = []
    if path.articles_order:
        for aid_str in path.articles_order:
            try:
                aid = UUID(aid_str)
                result = await db.execute(
                    select(Article).where(
                        Article.id == aid,
                        Article.user_id == current_user.id,
                    )
                )
                article = result.scalar_one_or_none()
                if article:
                    articles.append(article)
            except ValueError:
                continue
    
    # Build response
    response = LearningPathDetailResponse.model_validate(path)
    response.articles = articles
    return response


@router.patch("/{path_id}", response_model=LearningPathResponse)
async def update_path(
    path_id: UUID,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    progress: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update learning path."""
    result = await db.execute(
        select(LearningPath).where(
            LearningPath.id == path_id,
            LearningPath.user_id == current_user.id,
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    
    if title is not None:
        path.title = title
    if description is not None:
        path.description = description
    if status is not None:
        path.status = status
    if progress is not None:
        path.progress = max(0.0, min(100.0, progress))
        if path.progress >= 100:
            path.status = 'completed'
    
    await db.commit()
    await db.refresh(path)
    return path


@router.delete("/{path_id}", status_code=204)
async def delete_path(
    path_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a learning path."""
    result = await db.execute(
        select(LearningPath).where(
            LearningPath.id == path_id,
            LearningPath.user_id == current_user.id,
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    
    await db.delete(path)
    await db.commit()
