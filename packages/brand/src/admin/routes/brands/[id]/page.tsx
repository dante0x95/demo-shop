import { FetchError } from "@medusajs/js-sdk"
import {
  EllipsisHorizontal,
  PencilSquare,
  Photo,
  Spinner,
  Trash,
  TriangleRightMini,
} from "@medusajs/icons"
import {
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AdminBrandDetail,
  AdminBrandProduct,
  brandQueryKeys,
  deleteBrand,
  retrieveBrand,
} from "../../../lib/brands"
import { EditBrandDrawer } from "./components/edit-brand-drawer"

const isNotFound = (error: unknown) =>
  error instanceof FetchError && error.status === 404

const FieldRow = ({ label, value }: { label: string; value: string | null }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <Text size="small" leading="compact" className="break-all">
      {value || "-"}
    </Text>
  </div>
)

const GeneralSection = ({ brand }: { brand: AdminBrandDetail }) => {
  const [editOpen, setEditOpen] = useState(false)
  const prompt = usePrompt()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteBrand(brand.id),
    onSuccess: () => {
      // Leave first so the deleted brand's detail query is not refetched.
      navigate("/brands")
      queryClient.invalidateQueries({ queryKey: brandQueryKeys.all })
      toast.success(`Brand "${brand.name}" deleted`)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete brand")
    },
  })

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Delete brand?",
      description: `"${brand.name}" will be deleted. Products linked to this brand are unlinked, not deleted.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove()
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading>{brand.name}</Heading>
          {brand.is_active ? (
            <StatusBadge color="green">Active</StatusBadge>
          ) : (
            <StatusBadge color="grey">Inactive</StatusBadge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton
              size="small"
              variant="transparent"
              aria-label="Brand actions"
              disabled={isDeleting}
            >
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              className="gap-x-2"
              onClick={() => setEditOpen(true)}
            >
              <PencilSquare className="text-ui-fg-subtle" />
              Edit
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item className="gap-x-2" onClick={handleDelete}>
              <Trash className="text-ui-fg-subtle" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <FieldRow label="Handle" value={brand.handle} />
      <FieldRow label="Description" value={brand.description} />
      <FieldRow label="Logo URL" value={brand.logo_url} />
      <FieldRow label="Banner URL" value={brand.banner_url} />
      <EditBrandDrawer
        brand={brand}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Container>
  )
}

const ProductThumbnail = ({ src }: { src: string | null }) => (
  <div className="bg-ui-bg-component border-ui-border-base flex h-8 w-6 items-center justify-center overflow-hidden rounded-[4px] border">
    {src ? (
      <img src={src} alt="" className="h-full w-full object-cover" />
    ) : (
      <Photo className="text-ui-fg-subtle" />
    )}
  </div>
)

const ProductItem = ({ product }: { product: AdminBrandProduct }) => (
  <Link
    to={`/products/${product.id}`}
    className="outline-none focus-within:shadow-borders-interactive-with-focus rounded-md [&:hover>div]:bg-ui-bg-component-hover"
  >
    <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md px-4 py-2 transition-colors">
      <div className="flex items-center gap-3">
        <ProductThumbnail src={product.thumbnail} />
        <div className="flex flex-1 flex-col">
          <Text size="small" leading="compact" weight="plus">
            {product.title}
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {product.status}
          </Text>
        </div>
        <div className="flex size-7 items-center justify-center">
          <TriangleRightMini className="text-ui-fg-muted rtl:rotate-180" />
        </div>
      </div>
    </div>
  </Link>
)

const ProductsSection = ({ products }: { products: AdminBrandProduct[] }) => (
  <Container className="divide-y p-0">
    <div className="px-6 py-4">
      <Heading level="h2">Products</Heading>
    </div>
    {products.length ? (
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {products.map((product) => (
          <ProductItem key={product.id} product={product} />
        ))}
      </div>
    ) : (
      <div className="px-6 py-4">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          No products linked to this brand
        </Text>
      </div>
    )}
  </Container>
)

const NotFound = () => (
  <Container className="flex flex-col items-center gap-y-3 px-6 py-12">
    <Heading level="h2">Brand not found</Heading>
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      The brand does not exist or was deleted.
    </Text>
    <Button asChild size="small" variant="secondary">
      <Link to="/brands">Back to brands</Link>
    </Button>
  </Container>
)

const BrandDetailPage = () => {
  const { id } = useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: brandQueryKeys.detail(id!),
    queryFn: () => retrieveBrand(id!),
    // A 404 will not change on retry; show the not-found state right away.
    retry: (failureCount, err) => !isNotFound(err) && failureCount < 1,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="animate-spin" />
      </div>
    )
  }

  if (isNotFound(error)) {
    return <NotFound />
  }

  if (!data) {
    throw error
  }

  return (
    <div className="flex flex-col gap-y-3">
      <GeneralSection brand={data.brand} />
      <ProductsSection products={data.brand.products} />
    </div>
  )
}

export default BrandDetailPage
