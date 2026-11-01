from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from backend.domain.entities.user import User, Role
from backend.domain.entities.audit_log import AuditLog
from backend.domain.ports.audit_repository_port import AuditRepositoryPort
from backend.domain.exceptions.domain_exceptions import (
    InvalidCredentialsException,
    UserNotFoundException,
    DomainException,
)
from backend.domain.ports.user_repository_port import UserRepositoryPort
from backend.application.use_cases.authenticate_user_use_case import AuthenticateUserUseCase
from backend.application.use_cases.list_users_use_case import ListUsersUseCase
from backend.application.use_cases.update_user_use_case import UpdateUserUseCase
from backend.infrastructure.security.password_hasher import PasswordHasher
from backend.presentation.dependencies import (
    get_authenticate_user_use_case,
    get_audit_repository,
    get_list_users_use_case,
    get_update_user_use_case,
    get_user_repository,
    get_current_user,
    require_roles,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: Role


class UpdateUserRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    raw_req: Request,
    use_case: AuthenticateUserUseCase = Depends(get_authenticate_user_use_case),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> TokenResponse:
    """Authenticates credentials against database and issues a signed JWT token."""
    client_ip = raw_req.client.host if raw_req.client else None
    try:
        result = await use_case.execute(email=req.email, password=req.password)
        user_info = result["user"]
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=user_info["id"],
                user_email=user_info["email"],
                action="LOGIN",
                resource="/api/auth/login",
                details={"role": user_info["role"]},
                ip_address=client_ip,
            )
        )
        return TokenResponse(
            access_token=result["access_token"],
            token_type=result["token_type"],
            user=UserResponse(
                id=result["user"]["id"],
                email=result["user"]["email"],
                role=result["user"]["role"],
                is_active=True,
            ),
        )
    except InvalidCredentialsException:
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=None,
                user_email=req.email,
                action="LOGIN_FAILED",
                resource="/api/auth/login",
                details={"reason": "Credenciales inválidas"},
                ip_address=client_ip,
            )
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos.",
        )
    except Exception as e:
        logger.error(f"Error en login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno durante la autenticación.",
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Returns the currently authenticated user identity and role."""
    return UserResponse(
        id=current_user.id or 0,
        email=current_user.email,
        role=current_user.role.value,
        is_active=current_user.is_active,
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    use_case: ListUsersUseCase = Depends(get_list_users_use_case),
    _: User = Depends(require_roles([Role.ADMIN])),
) -> list[UserResponse]:
    """Admin-only: Retrieve all system users."""
    users = await use_case.execute()
    return [
        UserResponse(
            id=u.id or 0,
            email=u.email,
            role=u.role.value,
            is_active=u.is_active,
        )
        for u in users
    ]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    raw_req: Request,
    user_repo: UserRepositoryPort = Depends(get_user_repository),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
    current_admin: User = Depends(require_roles([Role.ADMIN])),
) -> UserResponse:
    """Admin-only endpoint to register a new user with an assigned execution role."""
    existing = await user_repo.get_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya se encuentra registrado.",
        )

    new_user = User(
        id=None,
        email=req.email.lower(),
        password_hash=PasswordHasher.hash(req.password),
        role=req.role,
        is_active=True,
    )
    created = await user_repo.create_user(new_user)
    await audit_repo.record_audit_log(
        AuditLog(
            id=None,
            user_id=current_admin.id,
            user_email=current_admin.email,
            action="USER_CREATE",
            resource=f"user:{created.id}",
            details={"created_email": created.email, "role": created.role.value},
            ip_address=raw_req.client.host if raw_req.client else None,
        )
    )
    return UserResponse(
        id=created.id or 0,
        email=created.email,
        role=created.role.value,
        is_active=created.is_active,
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    raw_req: Request,
    current_admin: User = Depends(require_roles([Role.ADMIN])),
    use_case: UpdateUserUseCase = Depends(get_update_user_use_case),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
) -> UserResponse:
    """Admin-only: Update user role or status (cannot self-deactivate)."""
    try:
        updated = await use_case.execute(
            current_admin_id=current_admin.id or 0,
            target_user_id=user_id,
            role=req.role,
            is_active=req.is_active,
        )
        await audit_repo.record_audit_log(
            AuditLog(
                id=None,
                user_id=current_admin.id,
                user_email=current_admin.email,
                action="USER_UPDATE",
                resource=f"user:{user_id}",
                details={"updated_role": req.role.value if req.role else None, "is_active": req.is_active},
                ip_address=raw_req.client.host if raw_req.client else None,
            )
        )
        return UserResponse(
            id=updated.id or 0,
            email=updated.email,
            role=updated.role.value,
            is_active=updated.is_active,
        )
    except UserNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DomainException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user_endpoint(
    user_id: int,
    raw_req: Request,
    current_admin: User = Depends(require_roles([Role.ADMIN])),
    user_repo: UserRepositoryPort = Depends(get_user_repository),
    audit_repo: AuditRepositoryPort = Depends(get_audit_repository),
):
    """Admin-only: Delete a system user by ID (cannot delete self)."""
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés eliminar tu propia cuenta de administrador.",
        )
    success = await user_repo.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )
    await audit_repo.record_audit_log(
        AuditLog(
            id=None,
            user_id=current_admin.id,
            user_email=current_admin.email,
            action="USER_DELETE",
            resource=f"user:{user_id}",
            details={"deleted_user_id": user_id},
            ip_address=raw_req.client.host if raw_req.client else None,
        )
    )
    return {"message": "Usuario eliminado correctamente."}
